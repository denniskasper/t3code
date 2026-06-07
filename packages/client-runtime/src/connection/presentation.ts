import type { ServerConfig } from "@t3tools/contracts";
import * as Option from "effect/Option";

import type { ConnectionCatalogEntry } from "./catalog.ts";
import type { NetworkStatus, SupervisorConnectionState } from "./model.ts";
import type { EnvironmentShellState } from "./runtime.ts";

export type EnvironmentConnectionPhase =
  | "available"
  | "offline"
  | "connecting"
  | "reconnecting"
  | "connected"
  | "error";

export interface EnvironmentConnectionPresentation {
  readonly phase: EnvironmentConnectionPhase;
  readonly error: string | null;
  readonly traceId: string | null;
}

export interface EnvironmentPresentation {
  readonly entry: ConnectionCatalogEntry;
  readonly connection: EnvironmentConnectionPresentation;
  readonly serverConfig: ServerConfig | null;
}

export function presentConnectionState(
  state: SupervisorConnectionState,
): EnvironmentConnectionPresentation {
  switch (state._tag) {
    case "Available":
      return { phase: "available", error: null, traceId: null };
    case "Offline":
      return { phase: "offline", error: null, traceId: null };
    case "Resolving":
    case "Connecting":
    case "Synchronizing":
      return {
        phase: state.attempt <= 1 ? "connecting" : "reconnecting",
        error: null,
        traceId: null,
      };
    case "Ready":
      return { phase: "connected", error: null, traceId: null };
    case "RetryWaiting":
    case "Blocked":
      return {
        phase: "error",
        error: state.error.message,
        traceId: state.error.traceId ?? null,
      };
  }
}

export function presentEnvironmentConnection(
  state: SupervisorConnectionState,
  shellState: EnvironmentShellState,
): EnvironmentConnectionPresentation {
  if (
    state._tag === "Synchronizing" &&
    shellState.status !== "synchronizing" &&
    Option.isSome(shellState.error)
  ) {
    return {
      phase: "error",
      error: shellState.error.value,
      traceId: null,
    };
  }
  return presentConnectionState(state);
}

export function connectionCatalogDisplayUrl(entry: ConnectionCatalogEntry): string | null {
  switch (entry.target._tag) {
    case "PrimaryConnectionTarget":
      return entry.target.httpBaseUrl;
    case "RelayConnectionTarget":
      return null;
    case "BearerConnectionTarget":
      return Option.isSome(entry.profile) && entry.profile.value._tag === "BearerConnectionProfile"
        ? entry.profile.value.httpBaseUrl
        : null;
    case "SshConnectionTarget":
      return Option.isSome(entry.profile) && entry.profile.value._tag === "SshConnectionProfile"
        ? `${entry.profile.value.target.username}@${entry.profile.value.target.hostname}`
        : null;
  }
}

export function connectionPhaseMessage(
  phase: EnvironmentConnectionPhase,
  label: string,
  networkStatus: NetworkStatus,
): string {
  if (networkStatus === "offline" || phase === "offline") {
    return "You are offline";
  }
  switch (phase) {
    case "available":
      return "Available";
    case "connecting":
      return `Connecting to ${label}...`;
    case "reconnecting":
      return `Reconnecting to ${label}...`;
    case "connected":
      return "Connected";
    case "error":
      return "Connection failed";
  }
}
