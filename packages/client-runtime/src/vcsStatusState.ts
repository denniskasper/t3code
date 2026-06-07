import type { EnvironmentId, GitManagerServiceError, VcsStatusResult } from "@t3tools/contracts";
import type * as Cause from "effect/Cause";

export interface VcsStatusState {
  readonly data: VcsStatusResult | null;
  readonly error: GitManagerServiceError | null;
  readonly cause: Cause.Cause<GitManagerServiceError> | null;
  readonly isPending: boolean;
}

export interface VcsStatusTarget {
  readonly environmentId: EnvironmentId | null;
  readonly cwd: string | null;
}

export const EMPTY_VCS_STATUS_STATE = Object.freeze<VcsStatusState>({
  data: null,
  error: null,
  cause: null,
  isPending: false,
});

export function getVcsStatusTargetKey(target: VcsStatusTarget): string | null {
  if (target.environmentId === null || target.cwd === null) {
    return null;
  }
  return `${target.environmentId}:${target.cwd}`;
}
