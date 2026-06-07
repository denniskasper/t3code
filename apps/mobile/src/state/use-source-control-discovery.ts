import type { EnvironmentId } from "@t3tools/contracts";

import { useMobileSourceControlCapabilities } from "../connection/mobileAppQueries";

export function useSourceControlDiscovery(environmentId: EnvironmentId | null) {
  return useMobileSourceControlCapabilities(environmentId);
}
