import { EnvironmentId } from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as Option from "effect/Option";

import { BearerConnectionProfile, type ConnectionCatalogEntry } from "./catalog.ts";
import { BearerConnectionTarget, ConnectionTransientError } from "./model.ts";
import {
  connectionCatalogDisplayUrl,
  connectionPhaseMessage,
  presentEnvironmentConnection,
  presentConnectionState,
} from "./presentation.ts";

const TARGET = new BearerConnectionTarget({
  environmentId: EnvironmentId.make("environment-1"),
  label: "Remote environment",
  connectionId: "connection-1",
});

const ENTRY: ConnectionCatalogEntry = {
  target: TARGET,
  profile: Option.some(
    new BearerConnectionProfile({
      connectionId: TARGET.connectionId,
      environmentId: TARGET.environmentId,
      label: TARGET.label,
      httpBaseUrl: "https://environment.example.test",
      wsBaseUrl: "wss://environment.example.test",
    }),
  ),
};

describe("connection presentation", () => {
  it("preserves profile display information without exposing credentials", () => {
    expect(connectionCatalogDisplayUrl(ENTRY)).toBe("https://environment.example.test");
  });

  it("distinguishes initial connection, reconnect, and retry errors", () => {
    expect(presentConnectionState({ _tag: "Connecting", attempt: 1 }).phase).toBe("connecting");
    expect(presentConnectionState({ _tag: "Connecting", attempt: 2 }).phase).toBe("reconnecting");
    expect(
      presentConnectionState({
        _tag: "RetryWaiting",
        attempt: 2,
        retryAt: 1,
        error: new ConnectionTransientError({
          reason: "transport",
          message: "Disconnected.",
          traceId: "trace-1",
        }),
      }),
    ).toEqual({
      phase: "error",
      error: "Disconnected.",
      traceId: "trace-1",
    });
  });

  it("gives offline status precedence in global messaging", () => {
    expect(connectionPhaseMessage("connected", TARGET.label, "offline")).toBe("You are offline");
  });

  it("surfaces a shell synchronization failure without claiming to reconnect", () => {
    expect(
      presentEnvironmentConnection(
        { _tag: "Synchronizing", attempt: 1 },
        {
          snapshot: Option.none(),
          status: "empty",
          error: Option.some("Could not synchronize environment data."),
        },
      ),
    ).toEqual({
      phase: "error",
      error: "Could not synchronize environment data.",
      traceId: null,
    });
  });
});
