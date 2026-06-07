import type { EnvironmentConnectionState } from "@t3tools/client-runtime";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";

export type { EnvironmentRuntimeState } from "@t3tools/client-runtime";

export interface ConnectedEnvironmentSummary {
  readonly environmentId: EnvironmentId;
  readonly environmentLabel: string;
  readonly displayUrl: string;
  readonly isRelayManaged: boolean;
  readonly connectionState: EnvironmentConnectionState;
  readonly connectionError: string | null;
  readonly connectionErrorTraceId: string | null;
}

export interface SelectedThreadRef {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
}
