import type {
  EnvironmentId,
  FilesystemBrowseInput,
  OrchestrationThread,
  ThreadId,
} from "@t3tools/contracts";
import * as Option from "effect/Option";
import { useEffect, useMemo, useState } from "react";

import {
  useMobileEnvironmentThread,
  useMobileFilesystemBrowse,
  useMobileFullThreadDiff,
  useMobileProjectSearchEntries,
  useMobileReviewDiffPreview,
  useMobileSourceControlDiscovery,
  useMobileTurnDiff,
  useMobileVcsListRefs,
  useMobileVcsStatus,
} from "./useMobileEnvironmentData";
import {
  buildMobileCheckpointDiffTargets,
  normalizeMobileComposerPathSearchQuery,
  type MobileCheckpointDiffTarget,
} from "./mobileAppQueryTargets";

const COMPOSER_PATH_SEARCH_DEBOUNCE_MS = 200;
const COMPOSER_PATH_SEARCH_LIMIT = 20;
const VCS_REF_LIST_LIMIT = 100;

export interface MobileThreadDetailView {
  readonly data: OrchestrationThread | null;
  readonly error: string | null;
  readonly isPending: boolean;
  readonly isDeleted: boolean;
}

export interface MobileComposerPathSearchTarget {
  readonly environmentId: EnvironmentId | null;
  readonly cwd: string | null;
  readonly query: string | null;
}

function useDebouncedValue<A>(value: A, delayMs: number): A {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [delayMs, value]);

  return debounced;
}

export function useMobileThreadDetail(
  environmentId: EnvironmentId | null,
  threadId: ThreadId | null,
): MobileThreadDetailView {
  const state = useMobileEnvironmentThread(environmentId, threadId);
  return {
    data: Option.getOrNull(state.data),
    error: Option.getOrNull(state.error),
    isPending: state.status === "synchronizing",
    isDeleted: state.status === "deleted",
  };
}

export function useMobileFilesystemDirectory(
  environmentId: EnvironmentId | null,
  input: FilesystemBrowseInput | null,
) {
  return useMobileFilesystemBrowse(
    environmentId !== null && input !== null ? { environmentId, input } : null,
  );
}

export function useMobileSourceControlCapabilities(environmentId: EnvironmentId | null) {
  return useMobileSourceControlDiscovery(environmentId);
}

export function useMobileBranches(input: {
  readonly environmentId: EnvironmentId | null;
  readonly cwd: string | null;
  readonly query?: string | null;
}) {
  const query = input.query?.trim() ?? "";
  return useMobileVcsListRefs(
    input.environmentId !== null && input.cwd !== null
      ? {
          environmentId: input.environmentId,
          input: {
            cwd: input.cwd,
            ...(query.length > 0 ? { query } : {}),
            limit: VCS_REF_LIST_LIMIT,
          },
        }
      : null,
  );
}

export function useMobileRepositoryStatus(input: {
  readonly environmentId: EnvironmentId | null;
  readonly cwd: string | null;
}) {
  return useMobileVcsStatus(
    input.environmentId !== null && input.cwd !== null
      ? {
          environmentId: input.environmentId,
          input: { cwd: input.cwd },
        }
      : null,
  );
}

export function useMobileReviewPreview(input: {
  readonly environmentId: EnvironmentId | null;
  readonly cwd: string | null;
}) {
  return useMobileReviewDiffPreview(
    input.environmentId !== null && input.cwd !== null
      ? {
          environmentId: input.environmentId,
          input: { cwd: input.cwd },
        }
      : null,
  );
}

export function useMobileComposerPathSearch(target: MobileComposerPathSearchTarget) {
  const normalizedTarget = useMemo(
    () => ({
      environmentId: target.environmentId,
      cwd: target.cwd,
      query: normalizeMobileComposerPathSearchQuery(target.query),
    }),
    [target.cwd, target.environmentId, target.query],
  );
  const debouncedTarget = useDebouncedValue(normalizedTarget, COMPOSER_PATH_SEARCH_DEBOUNCE_MS);
  const result = useMobileProjectSearchEntries(
    debouncedTarget.environmentId !== null &&
      debouncedTarget.cwd !== null &&
      debouncedTarget.query.length > 0
      ? {
          environmentId: debouncedTarget.environmentId,
          input: {
            cwd: debouncedTarget.cwd,
            query: debouncedTarget.query,
            limit: COMPOSER_PATH_SEARCH_LIMIT,
          },
        }
      : null,
  );

  return {
    entries: result.data?.entries ?? [],
    error: result.error,
    isPending: normalizedTarget.query !== debouncedTarget.query || result.isPending,
    refresh: result.refresh,
  };
}

export function useMobileCheckpointDiff(target: MobileCheckpointDiffTarget) {
  const targets = useMemo(
    () => buildMobileCheckpointDiffTargets(target),
    [
      target.environmentId,
      target.fromTurnCount,
      target.ignoreWhitespace,
      target.threadId,
      target.toTurnCount,
    ],
  );
  const fullThread = useMobileFullThreadDiff(targets.fullThread);
  const turn = useMobileTurnDiff(targets.turn);
  return targets.fullThread === null ? turn : fullThread;
}
