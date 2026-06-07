import type { VcsStatusTarget } from "@t3tools/client-runtime";

import { useMobileRepositoryStatus } from "../connection/mobileAppQueries";

export function useVcsStatus(target: VcsStatusTarget) {
  const state = useMobileRepositoryStatus(target);
  return {
    data: state.data,
    error: state.error,
    cause: null,
    isPending: state.isPending,
  };
}
