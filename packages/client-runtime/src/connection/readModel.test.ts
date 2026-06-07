import {
  EnvironmentId,
  ProjectId,
  ThreadId,
  type OrchestrationShellSnapshot,
} from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as Option from "effect/Option";

import type { ConnectionCatalogEntry } from "./catalog.ts";
import { PrimaryConnectionTarget } from "./model.ts";
import type { EnvironmentPresentation } from "./presentation.ts";
import { projectEnvironmentCatalog } from "./readModel.ts";
import type { EnvironmentShellState } from "./runtime.ts";

const ENVIRONMENT_A = EnvironmentId.make("environment-a");
const ENVIRONMENT_B = EnvironmentId.make("environment-b");

function presentation(environmentId: EnvironmentId): EnvironmentPresentation {
  const target = new PrimaryConnectionTarget({
    environmentId,
    label: environmentId,
    httpBaseUrl: `https://${environmentId}.example.test`,
    wsBaseUrl: `wss://${environmentId}.example.test`,
  });
  return {
    entry: {
      target,
      profile: Option.none(),
    } satisfies ConnectionCatalogEntry,
    connection: {
      phase: "connected",
      error: null,
      traceId: null,
    },
    serverConfig: null,
  };
}

function snapshot(
  environmentId: EnvironmentId,
  updatedAt: string,
  sessionStatus: "idle" | "running",
): OrchestrationShellSnapshot {
  const projectId = ProjectId.make(`project-${environmentId}`);
  return {
    snapshotSequence: 1,
    projects: [
      {
        id: projectId,
        title: `Project ${environmentId}`,
        workspaceRoot: `/workspace/${environmentId}`,
        createdAt: updatedAt,
        updatedAt,
      },
    ],
    threads: [
      {
        id: ThreadId.make(`thread-${environmentId}`),
        projectId,
        title: `Thread ${environmentId}`,
        createdAt: updatedAt,
        updatedAt,
        session: {
          status: sessionStatus,
        },
      },
    ],
    updatedAt,
  } as unknown as OrchestrationShellSnapshot;
}

describe("projectEnvironmentCatalog", () => {
  it("projects cached and live snapshots without losing environment scope", () => {
    const snapshotA = snapshot(ENVIRONMENT_A, "2026-06-06T00:00:00.000Z", "idle");
    const snapshotB = snapshot(ENVIRONMENT_B, "2026-06-06T00:01:00.000Z", "running");
    const shellStates = new Map<EnvironmentId, EnvironmentShellState>([
      [
        ENVIRONMENT_A,
        {
          snapshot: Option.some(snapshotA),
          status: "cached",
          error: Option.none(),
        },
      ],
      [
        ENVIRONMENT_B,
        {
          snapshot: Option.some(snapshotB),
          status: "live",
          error: Option.some("Stream interrupted."),
        },
      ],
    ]);

    const result = projectEnvironmentCatalog(
      new Map([
        [ENVIRONMENT_A, presentation(ENVIRONMENT_A)],
        [ENVIRONMENT_B, presentation(ENVIRONMENT_B)],
      ]),
      shellStates,
    );

    expect(result.projects.map((project) => project.environmentId)).toEqual([
      ENVIRONMENT_A,
      ENVIRONMENT_B,
    ]);
    expect(result.threads.map((thread) => thread.environmentId)).toEqual([
      ENVIRONMENT_B,
      ENVIRONMENT_A,
    ]);
    expect(result.snapshotByEnvironmentId.get(ENVIRONMENT_A)).toBe(snapshotA);
    expect(result.snapshotByEnvironmentId.get(ENVIRONMENT_B)).toBe(snapshotB);
    expect(result.shellErrorByEnvironmentId.get(ENVIRONMENT_B)).toBe("Stream interrupted.");
    expect(result.latestSnapshotUpdatedAt).toBe("2026-06-06T00:01:00.000Z");
    expect(result.hasCachedData).toBe(true);
    expect(result.hasLiveData).toBe(true);
    expect(result.hasRemoteActivity).toBe(true);
  });
});
