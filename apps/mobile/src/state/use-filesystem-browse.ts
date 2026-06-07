import type { EnvironmentId, FilesystemBrowseInput } from "@t3tools/contracts";

import { useMobileFilesystemDirectory } from "../connection/mobileAppQueries";

export function useFilesystemBrowse(
  environmentId: EnvironmentId | null,
  input: FilesystemBrowseInput | null,
) {
  return useMobileFilesystemDirectory(environmentId, input);
}
