import type { VcsStatusTarget } from "@t3tools/client-runtime";

import { useWebRepositoryStatus } from "../connection/webAppQueries";

export type { VcsStatusTarget };

export function resetVcsStatusStateForTests(): void {}

export function useVcsStatus(target: VcsStatusTarget) {
  const state = useWebRepositoryStatus(target);
  return {
    data: state.data,
    error: state.error,
    isPending: state.isPending,
  };
}
