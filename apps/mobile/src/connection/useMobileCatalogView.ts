import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId, ServerConfig } from "@t3tools/contracts";
import { useMemo } from "react";

import { mobileEnvironmentConnections } from "./mobileConnectionRuntime";
import { type MobileEnvironmentPresentation, useMobileEnvironments } from "./useMobileEnvironments";

export interface MobileCatalogViewState {
  readonly isReady: boolean;
  readonly hasEnvironments: boolean;
  readonly hasShellSnapshot: boolean;
  readonly hasPendingShellSnapshot: boolean;
  readonly hasConnectedEnvironment: boolean;
  readonly hasConnectingEnvironment: boolean;
  readonly connectingEnvironments: ReadonlyArray<MobileEnvironmentPresentation>;
  readonly connectionError: string | null;
  readonly shellError: string | null;
  readonly isUsingCachedData: boolean;
  readonly latestSnapshotUpdatedAt: string | null;
}

export function useMobileCatalogView() {
  const { isReady, networkStatus, environments } = useMobileEnvironments();
  const readModel = useAtomValue(mobileEnvironmentConnections.catalogReadModelAtom);

  const state = useMemo<MobileCatalogViewState>(() => {
    const connectingEnvironments = environments.filter(
      (environment) =>
        environment.connection.phase === "connecting" ||
        environment.connection.phase === "reconnecting",
    );
    const connectionError =
      environments.find((environment) => environment.connection.error !== null)?.connection.error ??
      null;
    const shellError = readModel.shellErrorByEnvironmentId.values().next().value ?? null;

    return {
      isReady,
      hasEnvironments: environments.length > 0,
      hasShellSnapshot: readModel.snapshotByEnvironmentId.size > 0,
      hasPendingShellSnapshot: [...readModel.shellStatusByEnvironmentId.values()].some(
        (status) => status === "synchronizing",
      ),
      hasConnectedEnvironment: environments.some(
        (environment) => environment.connection.phase === "connected",
      ),
      hasConnectingEnvironment: connectingEnvironments.length > 0,
      connectingEnvironments,
      connectionError,
      shellError,
      isUsingCachedData: readModel.hasCachedData,
      latestSnapshotUpdatedAt: readModel.latestSnapshotUpdatedAt,
    };
  }, [environments, isReady, readModel]);

  return {
    projects: readModel.projects,
    threads: readModel.threads,
    serverConfigByEnvironmentId: readModel.serverConfigByEnvironmentId as ReadonlyMap<
      EnvironmentId,
      ServerConfig
    >,
    networkStatus,
    state,
    hasRemoteActivity: readModel.hasRemoteActivity,
  };
}
