import { ORCHESTRATION_WS_METHODS, WS_METHODS } from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";

import { makeEnvironmentOperations } from "./operations.ts";
import type { EnvironmentRpcService } from "./runtime.ts";

describe("EnvironmentOperations", () => {
  it.effect("routes unary, finite stream, and subscription operations distinctly", () =>
    Effect.gen(function* () {
      const calls: Array<{
        readonly kind: "request" | "runStream" | "subscribe";
        readonly tag: string;
        readonly input: unknown;
      }> = [];
      const rpc: EnvironmentRpcService = {
        config: Effect.never,
        request: ((tag: string, input: unknown) =>
          Effect.sync(() => {
            calls.push({ kind: "request", tag, input });
            return undefined;
          })) as EnvironmentRpcService["request"],
        runStream: ((tag: string, input: unknown) => {
          calls.push({ kind: "runStream", tag, input });
          return Stream.empty;
        }) as EnvironmentRpcService["runStream"],
        subscribe: ((tag: string, input: unknown) => {
          calls.push({ kind: "subscribe", tag, input });
          return Stream.empty;
        }) as EnvironmentRpcService["subscribe"],
      };
      const operations = yield* makeEnvironmentOperations(rpc);

      yield* operations.server.getConfig();
      yield* operations.orchestration.getArchivedShellSnapshot();
      yield* operations.cloud.installRelayClient({}).pipe(Stream.runDrain);
      yield* operations.terminal.events({}).pipe(Stream.runDrain);

      expect(calls).toEqual([
        {
          kind: "request",
          tag: WS_METHODS.serverGetConfig,
          input: {},
        },
        {
          kind: "request",
          tag: ORCHESTRATION_WS_METHODS.getArchivedShellSnapshot,
          input: {},
        },
        {
          kind: "runStream",
          tag: WS_METHODS.cloudInstallRelayClient,
          input: {},
        },
        {
          kind: "subscribe",
          tag: WS_METHODS.subscribeTerminalEvents,
          input: {},
        },
      ]);
    }),
  );
});
