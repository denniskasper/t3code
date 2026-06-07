import { EnvironmentId } from "@t3tools/contracts";
import * as Schema from "effect/Schema";

const ConnectionTargetBase = {
  environmentId: EnvironmentId,
  label: Schema.String,
};

export class PrimaryConnectionTarget extends Schema.TaggedClass<PrimaryConnectionTarget>()(
  "PrimaryConnectionTarget",
  {
    ...ConnectionTargetBase,
    httpBaseUrl: Schema.String,
    wsBaseUrl: Schema.String,
  },
) {}

export class BearerConnectionTarget extends Schema.TaggedClass<BearerConnectionTarget>()(
  "BearerConnectionTarget",
  {
    ...ConnectionTargetBase,
    connectionId: Schema.String,
  },
) {}

export class RelayConnectionTarget extends Schema.TaggedClass<RelayConnectionTarget>()(
  "RelayConnectionTarget",
  {
    ...ConnectionTargetBase,
  },
) {}

export class SshConnectionTarget extends Schema.TaggedClass<SshConnectionTarget>()(
  "SshConnectionTarget",
  {
    ...ConnectionTargetBase,
    connectionId: Schema.String,
  },
) {}

export const ConnectionTarget = Schema.Union([
  PrimaryConnectionTarget,
  BearerConnectionTarget,
  RelayConnectionTarget,
  SshConnectionTarget,
]);
export type ConnectionTarget = typeof ConnectionTarget.Type;

export const PersistedConnectionTarget = Schema.Union([
  BearerConnectionTarget,
  RelayConnectionTarget,
  SshConnectionTarget,
]);
export type PersistedConnectionTarget = typeof PersistedConnectionTarget.Type;

export type ConnectionTargetKind = ConnectionTarget["_tag"];

export type NetworkStatus = "unknown" | "offline" | "online";

export type ConnectionTransientReason =
  | "network"
  | "timeout"
  | "transport"
  | "endpoint-unavailable"
  | "relay-unavailable"
  | "remote-unavailable";

export type ConnectionBlockedReason =
  | "authentication"
  | "configuration"
  | "permission"
  | "unsupported";

export class ConnectionTransientError extends Schema.TaggedErrorClass<ConnectionTransientError>()(
  "ConnectionTransientError",
  {
    reason: Schema.Literals([
      "network",
      "timeout",
      "transport",
      "endpoint-unavailable",
      "relay-unavailable",
      "remote-unavailable",
    ]),
    message: Schema.String,
    traceId: Schema.optionalKey(Schema.String),
  },
) {}

export class ConnectionBlockedError extends Schema.TaggedErrorClass<ConnectionBlockedError>()(
  "ConnectionBlockedError",
  {
    reason: Schema.Literals(["authentication", "configuration", "permission", "unsupported"]),
    message: Schema.String,
    traceId: Schema.optionalKey(Schema.String),
  },
) {}

export type ConnectionAttemptError = ConnectionTransientError | ConnectionBlockedError;

export interface PreparedConnection {
  readonly environmentId: EnvironmentId;
  readonly label: string;
  readonly httpBaseUrl: string;
  readonly socketUrl: string;
  readonly target: ConnectionTarget;
}

export interface AvailableConnectionState {
  readonly _tag: "Available";
}

export interface OfflineConnectionState {
  readonly _tag: "Offline";
}

export interface ResolvingConnectionState {
  readonly _tag: "Resolving";
  readonly attempt: number;
}

export interface ConnectingConnectionState {
  readonly _tag: "Connecting";
  readonly attempt: number;
}

export interface SynchronizingConnectionState {
  readonly _tag: "Synchronizing";
  readonly attempt: number;
}

export interface ReadyConnectionState {
  readonly _tag: "Ready";
  readonly attempt: number;
  readonly generation: number;
}

export interface RetryWaitingConnectionState {
  readonly _tag: "RetryWaiting";
  readonly attempt: number;
  readonly retryAt: number;
  readonly error: ConnectionTransientError;
}

export interface BlockedConnectionState {
  readonly _tag: "Blocked";
  readonly error: ConnectionBlockedError;
}

export type SupervisorConnectionState =
  | AvailableConnectionState
  | OfflineConnectionState
  | ResolvingConnectionState
  | ConnectingConnectionState
  | SynchronizingConnectionState
  | ReadyConnectionState
  | RetryWaitingConnectionState
  | BlockedConnectionState;

export type ConnectionProjectionPhase = "disconnected" | "synchronizing" | "ready";

export function connectionProjectionPhase(
  state: SupervisorConnectionState,
): ConnectionProjectionPhase {
  switch (state._tag) {
    case "Resolving":
    case "Connecting":
    case "Synchronizing":
      return "synchronizing";
    case "Ready":
      return "ready";
    case "Available":
    case "Offline":
    case "RetryWaiting":
    case "Blocked":
      return "disconnected";
  }
}

export const AVAILABLE_CONNECTION_STATE: AvailableConnectionState = Object.freeze({
  _tag: "Available",
});
