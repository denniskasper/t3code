import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId, ServerConfig } from "@t3tools/contracts";
import { useMemo } from "react";

import { mobileEnvironmentConnections } from "./mobileConnectionRuntime";
import {
  projectMobileWorkspaceEnvironment,
  projectMobileWorkspaceState,
} from "./mobileWorkspaceModel";
import { useMobileEnvironments } from "./useMobileEnvironments";

export function useMobileWorkspace() {
  const { isReady, networkStatus, environments } = useMobileEnvironments();
  const readModel = useAtomValue(mobileEnvironmentConnections.catalogReadModelAtom);
  const projectedEnvironments = useMemo(
    () => environments.map(projectMobileWorkspaceEnvironment),
    [environments],
  );
  const state = useMemo(
    () =>
      projectMobileWorkspaceState({
        isReady,
        networkStatus,
        environments: projectedEnvironments,
        readModel,
      }),
    [isReady, networkStatus, projectedEnvironments, readModel],
  );

  return {
    environments: projectedEnvironments,
    projects: readModel.projects,
    threads: readModel.threads,
    serverConfigByEnvironmentId: readModel.serverConfigByEnvironmentId as ReadonlyMap<
      EnvironmentId,
      ServerConfig
    >,
    state,
    hasRemoteActivity: readModel.hasRemoteActivity,
  };
}
