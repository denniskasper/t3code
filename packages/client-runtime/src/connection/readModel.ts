import type { EnvironmentId, OrchestrationShellSnapshot, ServerConfig } from "@t3tools/contracts";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Order from "effect/Order";

import {
  scopeProjectShell,
  scopeThreadShell,
  type EnvironmentScopedProjectShell,
  type EnvironmentScopedThreadShell,
} from "../shellTypes.ts";
import type { EnvironmentPresentation } from "./presentation.ts";
import type { EnvironmentShellState, EnvironmentShellStatus } from "./runtime.ts";

const projectsSortOrder = Order.mapInput(
  Order.Struct({
    title: Order.String,
    environmentId: Order.String,
  }),
  (project: EnvironmentScopedProjectShell) => ({
    title: project.title,
    environmentId: project.environmentId,
  }),
);

const threadsSortOrder = Order.mapInput(
  Order.Struct({
    activityAt: Order.flip(Order.String),
    environmentId: Order.String,
  }),
  (thread: EnvironmentScopedThreadShell) => ({
    activityAt: thread.updatedAt ?? thread.createdAt,
    environmentId: thread.environmentId,
  }),
);

export interface EnvironmentCatalogReadModel {
  readonly projects: ReadonlyArray<EnvironmentScopedProjectShell>;
  readonly threads: ReadonlyArray<EnvironmentScopedThreadShell>;
  readonly snapshotByEnvironmentId: ReadonlyMap<EnvironmentId, OrchestrationShellSnapshot>;
  readonly shellStatusByEnvironmentId: ReadonlyMap<EnvironmentId, EnvironmentShellStatus>;
  readonly shellErrorByEnvironmentId: ReadonlyMap<EnvironmentId, string>;
  readonly serverConfigByEnvironmentId: ReadonlyMap<EnvironmentId, ServerConfig>;
  readonly latestSnapshotUpdatedAt: string | null;
  readonly hasCachedData: boolean;
  readonly hasLiveData: boolean;
  readonly hasRemoteActivity: boolean;
}

export function projectEnvironmentCatalog(
  presentations: ReadonlyMap<EnvironmentId, EnvironmentPresentation>,
  shellStates: ReadonlyMap<EnvironmentId, EnvironmentShellState>,
): EnvironmentCatalogReadModel {
  const projects: EnvironmentScopedProjectShell[] = [];
  const threads: EnvironmentScopedThreadShell[] = [];
  const snapshotByEnvironmentId = new Map<EnvironmentId, OrchestrationShellSnapshot>();
  const shellStatusByEnvironmentId = new Map<EnvironmentId, EnvironmentShellStatus>();
  const shellErrorByEnvironmentId = new Map<EnvironmentId, string>();
  const serverConfigByEnvironmentId = new Map<EnvironmentId, ServerConfig>();
  let latestSnapshotUpdatedAt: string | null = null;
  let hasCachedData = false;
  let hasLiveData = false;
  let hasRemoteActivity = false;

  for (const [environmentId, presentation] of presentations) {
    if (presentation.serverConfig !== null) {
      serverConfigByEnvironmentId.set(environmentId, presentation.serverConfig);
    }
  }

  for (const [environmentId, shellState] of shellStates) {
    shellStatusByEnvironmentId.set(environmentId, shellState.status);
    if (Option.isSome(shellState.error)) {
      shellErrorByEnvironmentId.set(environmentId, shellState.error.value);
    }
    hasCachedData ||= shellState.status === "cached";
    hasLiveData ||= shellState.status === "live";

    if (Option.isNone(shellState.snapshot)) {
      continue;
    }

    const snapshot = shellState.snapshot.value;
    snapshotByEnvironmentId.set(environmentId, snapshot);
    if (latestSnapshotUpdatedAt === null || snapshot.updatedAt > latestSnapshotUpdatedAt) {
      latestSnapshotUpdatedAt = snapshot.updatedAt;
    }
    for (const project of snapshot.projects) {
      projects.push(scopeProjectShell(environmentId, project));
    }
    for (const thread of snapshot.threads) {
      threads.push(scopeThreadShell(environmentId, thread));
      hasRemoteActivity ||=
        thread.session?.status === "running" || thread.session?.status === "starting";
    }
  }

  return {
    projects: Arr.sort(projects, projectsSortOrder),
    threads: Arr.sort(threads, threadsSortOrder),
    snapshotByEnvironmentId,
    shellStatusByEnvironmentId,
    shellErrorByEnvironmentId,
    serverConfigByEnvironmentId,
    latestSnapshotUpdatedAt,
    hasCachedData,
    hasLiveData,
    hasRemoteActivity,
  };
}
