import type { ComposerPathSearchTarget } from "@t3tools/client-runtime";

import { useMobileComposerPathSearch } from "../connection/mobileAppQueries";

export function useComposerPathSearch(target: ComposerPathSearchTarget) {
  return useMobileComposerPathSearch(target);
}
