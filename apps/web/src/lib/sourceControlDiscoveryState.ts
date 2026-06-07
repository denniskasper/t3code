import type { EnvironmentId } from "@t3tools/contracts";

import { useWebSourceControlCapabilities } from "../connection/webAppQueries";
import { useWebPrimaryEnvironment } from "../connection/useWebEnvironments";

interface SourceControlDiscoveryTargetInput {
  readonly environmentId?: EnvironmentId | null;
}

export function resetSourceControlDiscoveryStateForTests(): void {}

export function useSourceControlDiscovery(input?: SourceControlDiscoveryTargetInput) {
  const primaryEnvironment = useWebPrimaryEnvironment();
  return useWebSourceControlCapabilities(
    input?.environmentId ?? primaryEnvironment?.environmentId ?? null,
  );
}
