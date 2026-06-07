import type {
  EnvironmentId,
  VcsListRefsResult,
  VcsRef as ContractVcsRef,
} from "@t3tools/contracts";

export interface VcsRefTarget {
  readonly environmentId: EnvironmentId | null;
  readonly cwd: string | null;
  readonly query?: string | null;
}

export interface VcsRefScope {
  readonly environmentId: EnvironmentId | null;
  readonly cwd: string | null;
}

export interface VcsRefState {
  readonly data: VcsListRefsResult | null;
  readonly isPending: boolean;
  readonly error: string | null;
}

export type VcsRef = ContractVcsRef;

export const EMPTY_VCS_REF_STATE = Object.freeze<VcsRefState>({
  data: null,
  isPending: false,
  error: null,
});

export function getVcsRefTargetKey(target: VcsRefTarget): string | null {
  if (target.environmentId === null || target.cwd === null) {
    return null;
  }
  return `${target.environmentId}:${target.cwd}:${target.query?.trim() ?? ""}`;
}
