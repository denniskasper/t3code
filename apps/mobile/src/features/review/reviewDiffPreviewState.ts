import type { EnvironmentId } from "@t3tools/contracts";

import { useMobileReviewPreview } from "../../connection/mobileAppQueries";

export function useReviewDiffPreview(input: {
  readonly environmentId?: EnvironmentId;
  readonly cwd: string | null;
}) {
  return useMobileReviewPreview({
    environmentId: input.environmentId ?? null,
    cwd: input.cwd,
  });
}
