import type { CheckpointDiffState, CheckpointDiffTarget } from "@t3tools/client-runtime";

import { useWebCheckpointDiff } from "../connection/webAppQueries";

export function useCheckpointDiff(
  target: CheckpointDiffTarget,
  options?: { readonly enabled?: boolean },
): CheckpointDiffState {
  const state = useWebCheckpointDiff(target, options);
  return {
    data: state.data,
    error: state.error,
    isPending: state.isPending,
  };
}
