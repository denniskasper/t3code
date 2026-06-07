import type { EnvironmentConnectionState } from "@t3tools/client-runtime";

import type { MobileWorkspaceState } from "../connection/mobileWorkspaceModel";
import { useMobileWorkspace } from "../connection/useMobileWorkspace";

export interface RemoteCatalogState {
  readonly isLoadingSavedConnections: boolean;
  readonly hasSavedConnections: boolean;
  readonly hasLoadedShellSnapshot: boolean;
  readonly hasPendingShellSnapshot: boolean;
  readonly hasReadyEnvironment: boolean;
  readonly hasConnectingEnvironment: boolean;
  readonly connectingEnvironments: MobileWorkspaceState["connectingEnvironments"];
  readonly connectionState: EnvironmentConnectionState;
  readonly connectionError: string | null;
  readonly shellSnapshotError: string | null;
  readonly isUsingCachedData: boolean;
  readonly latestCachedSnapshotReceivedAt: string | null;
}

export function useRemoteCatalog() {
  const workspace = useMobileWorkspace();
  const state: RemoteCatalogState = {
    isLoadingSavedConnections: workspace.state.isLoadingConnections,
    hasSavedConnections: workspace.state.hasConnections,
    hasLoadedShellSnapshot: workspace.state.hasLoadedShellSnapshot,
    hasPendingShellSnapshot: workspace.state.hasPendingShellSnapshot,
    hasReadyEnvironment: workspace.state.hasReadyEnvironment,
    hasConnectingEnvironment: workspace.state.hasConnectingEnvironment,
    connectingEnvironments: workspace.state.connectingEnvironments,
    connectionState: workspace.state.connectionState,
    connectionError: workspace.state.connectionError,
    shellSnapshotError: workspace.state.shellSnapshotError,
    isUsingCachedData: workspace.state.isUsingCachedData,
    latestCachedSnapshotReceivedAt: workspace.state.latestCachedSnapshotReceivedAt,
  };

  return {
    projects: workspace.projects,
    threads: workspace.threads,
    serverConfigByEnvironmentId: Object.fromEntries(workspace.serverConfigByEnvironmentId),
    connectionState: state.connectionState,
    connectionError: state.connectionError,
    state,
    hasRemoteActivity: workspace.hasRemoteActivity,
  };
}
