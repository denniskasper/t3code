import type {
  EnvironmentCatalogReadModel,
  EnvironmentConnectionPhase,
  NetworkStatus,
} from "@t3tools/client-runtime";
import type { EnvironmentId, ServerConfig } from "@t3tools/contracts";

import type { MobileEnvironmentPresentation } from "./useMobileEnvironments";

export type MobileWorkspaceConnectionState =
  | "idle"
  | "connecting"
  | "ready"
  | "reconnecting"
  | "disconnected";

export interface MobileWorkspaceEnvironment {
  readonly environmentId: EnvironmentId;
  readonly environmentLabel: string;
  readonly displayUrl: string;
  readonly isRelayManaged: boolean;
  readonly connectionState: MobileWorkspaceConnectionState;
  readonly connectionPhase: EnvironmentConnectionPhase;
  readonly connectionError: string | null;
  readonly connectionErrorTraceId: string | null;
}

export interface MobileWorkspaceState {
  readonly isLoadingConnections: boolean;
  readonly hasConnections: boolean;
  readonly hasLoadedShellSnapshot: boolean;
  readonly hasPendingShellSnapshot: boolean;
  readonly hasReadyEnvironment: boolean;
  readonly hasConnectingEnvironment: boolean;
  readonly connectingEnvironments: ReadonlyArray<MobileWorkspaceEnvironment>;
  readonly connectionState: MobileWorkspaceConnectionState;
  readonly connectionError: string | null;
  readonly shellSnapshotError: string | null;
  readonly isUsingCachedData: boolean;
  readonly latestCachedSnapshotReceivedAt: string | null;
  readonly networkStatus: NetworkStatus;
}

function legacyConnectionState(phase: EnvironmentConnectionPhase): MobileWorkspaceConnectionState {
  switch (phase) {
    case "available":
      return "idle";
    case "connecting":
      return "connecting";
    case "reconnecting":
      return "reconnecting";
    case "connected":
      return "ready";
    case "offline":
    case "error":
      return "disconnected";
  }
}

export function projectMobileWorkspaceEnvironment(
  environment: MobileEnvironmentPresentation,
): MobileWorkspaceEnvironment {
  return {
    environmentId: environment.environmentId,
    environmentLabel: environment.label,
    displayUrl: environment.displayUrl ?? "",
    isRelayManaged: environment.relayManaged,
    connectionState: legacyConnectionState(environment.connection.phase),
    connectionPhase: environment.connection.phase,
    connectionError: environment.connection.error,
    connectionErrorTraceId: environment.connection.traceId,
  };
}

function overallConnectionState(
  environments: ReadonlyArray<MobileWorkspaceEnvironment>,
  networkStatus: NetworkStatus,
): MobileWorkspaceConnectionState {
  if (environments.length === 0) {
    return "idle";
  }
  if (networkStatus === "offline") {
    return "disconnected";
  }
  if (environments.some((environment) => environment.connectionState === "ready")) {
    return "ready";
  }
  if (environments.some((environment) => environment.connectionState === "reconnecting")) {
    return "reconnecting";
  }
  if (environments.some((environment) => environment.connectionState === "connecting")) {
    return "connecting";
  }
  return "disconnected";
}

export function projectMobileWorkspaceState(input: {
  readonly isReady: boolean;
  readonly networkStatus: NetworkStatus;
  readonly environments: ReadonlyArray<MobileWorkspaceEnvironment>;
  readonly readModel: EnvironmentCatalogReadModel;
}): MobileWorkspaceState {
  const connectingEnvironments = input.environments.filter(
    (environment) =>
      environment.connectionState === "connecting" ||
      environment.connectionState === "reconnecting",
  );

  return {
    isLoadingConnections: !input.isReady,
    hasConnections: input.environments.length > 0,
    hasLoadedShellSnapshot: input.readModel.snapshotByEnvironmentId.size > 0,
    hasPendingShellSnapshot: [...input.readModel.shellStatusByEnvironmentId.values()].some(
      (status) => status === "synchronizing",
    ),
    hasReadyEnvironment: input.environments.some(
      (environment) => environment.connectionState === "ready",
    ),
    hasConnectingEnvironment: connectingEnvironments.length > 0,
    connectingEnvironments,
    connectionState: overallConnectionState(input.environments, input.networkStatus),
    connectionError:
      input.environments.find((environment) => environment.connectionError !== null)
        ?.connectionError ?? null,
    shellSnapshotError: input.readModel.shellErrorByEnvironmentId.values().next().value ?? null,
    isUsingCachedData: input.readModel.hasCachedData,
    latestCachedSnapshotReceivedAt: input.readModel.latestSnapshotUpdatedAt,
    networkStatus: input.networkStatus,
  };
}

export type MobileServerConfigByEnvironmentId = ReadonlyMap<EnvironmentId, ServerConfig>;
