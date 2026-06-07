import type { ComposerPathSearchState, ComposerPathSearchTarget } from "@t3tools/client-runtime";

import { useWebComposerPathSearch } from "../connection/webAppQueries";

export function useComposerPathSearch(target: ComposerPathSearchTarget): ComposerPathSearchState {
  const state = useWebComposerPathSearch(target);
  return {
    entries: state.entries.map((entry) => ({
      path: entry.path,
      kind: entry.kind,
      ...(entry.parentPath === undefined ? {} : { parentPath: entry.parentPath }),
    })),
    error: state.error,
    isPending: state.isPending,
  };
}
