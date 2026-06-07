import { EnvironmentId } from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";
import * as TestClock from "effect/testing/TestClock";

import type { WsRpcProtocolClient } from "../wsRpcProtocol.ts";
import { ConnectionBroker } from "./broker.ts";
import { Connectivity } from "./connectivity.ts";
import {
  ConnectionBlockedError,
  ConnectionTransientError,
  PrimaryConnectionTarget,
  type ConnectionAttemptError,
  type ConnectionTarget,
  type NetworkStatus,
  type PreparedConnection,
  type SupervisorConnectionState,
} from "./model.ts";
import { RpcSessionFactory, type RpcSession } from "./rpcSession.ts";
import { makeEnvironmentSupervisor } from "./supervisor.ts";
import { ConnectionWakeups } from "./wakeups.ts";

const TARGET = new PrimaryConnectionTarget({
  environmentId: EnvironmentId.make("environment-1"),
  label: "Test environment",
  httpBaseUrl: "https://environment.example.test",
  wsBaseUrl: "wss://environment.example.test",
});

const PREPARED_CONNECTION: PreparedConnection = {
  environmentId: TARGET.environmentId,
  label: TARGET.label,
  httpBaseUrl: TARGET.httpBaseUrl,
  socketUrl: "wss://environment.example.test/ws",
  target: TARGET,
};

const TEST_RPC_CLIENT = {} as WsRpcProtocolClient;

function transient(message = "Connection failed.") {
  return new ConnectionTransientError({
    reason: "transport",
    message,
  });
}

function blocked(message = "Authentication required.") {
  return new ConnectionBlockedError({
    reason: "authentication",
    message,
  });
}

function awaitState(
  state: SubscriptionRef.SubscriptionRef<SupervisorConnectionState>,
  predicate: (value: SupervisorConnectionState) => boolean,
) {
  return SubscriptionRef.changes(state).pipe(
    Stream.filter(predicate),
    Stream.runHead,
    Effect.map(Option.getOrThrow),
  );
}

const makeHarness = Effect.fn("TestConnectionHarness.make")(function* (options?: {
  readonly networkStatus?: NetworkStatus;
  readonly prepare?: (
    attempt: number,
    target: ConnectionTarget,
  ) => Effect.Effect<PreparedConnection, ConnectionAttemptError>;
  readonly ready?: (attempt: number) => Effect.Effect<void, ConnectionAttemptError>;
  readonly probe?: (attempt: number) => Effect.Effect<void, ConnectionAttemptError>;
}) {
  const networkStatus = yield* SubscriptionRef.make<NetworkStatus>(
    options?.networkStatus ?? "online",
  );
  const prepareCount = yield* Ref.make(0);
  const sessionCount = yield* Ref.make(0);
  const releaseCount = yield* Ref.make(0);
  const wakeups = yield* SubscriptionRef.make<{
    readonly sequence: number;
    readonly reason: "application-active" | "credentials-changed";
  }>({
    sequence: 0,
    reason: "application-active",
  });
  const closedSessions = yield* Ref.make<
    ReadonlyArray<Deferred.Deferred<never, ConnectionTransientError>>
  >([]);

  const connectivity = Connectivity.of({
    status: SubscriptionRef.get(networkStatus),
    changes: SubscriptionRef.changes(networkStatus),
  });

  const prepare = Effect.fn("TestConnectionBroker.prepare")(function* (target: ConnectionTarget) {
    const attempt = yield* Ref.updateAndGet(prepareCount, (count) => count + 1);
    if (options?.prepare) {
      return yield* options.prepare(attempt, target);
    }
    return PREPARED_CONNECTION;
  });

  const connect = Effect.fn("TestRpcSessionFactory.connect")(function* () {
    const attempt = yield* Ref.updateAndGet(sessionCount, (count) => count + 1);
    const closed = yield* Deferred.make<never, ConnectionTransientError>();
    yield* Ref.update(closedSessions, (sessions) => [...sessions, closed]);

    const session: RpcSession = {
      client: TEST_RPC_CLIENT,
      initialConfig: Effect.die(new Error("Initial config is not used by supervisor tests.")),
      ready: options?.ready?.(attempt) ?? Effect.void,
      probe: options?.probe?.(attempt) ?? Effect.void,
      closed: Deferred.await(closed),
    };

    return yield* Effect.acquireRelease(Effect.succeed(session), () =>
      Ref.update(releaseCount, (count) => count + 1),
    );
  });

  const dependencies = Layer.mergeAll(
    Layer.succeed(Connectivity, connectivity),
    Layer.succeed(
      ConnectionWakeups,
      ConnectionWakeups.of({
        changes: SubscriptionRef.changes(wakeups).pipe(
          Stream.drop(1),
          Stream.map((event) => event.reason),
        ),
      }),
    ),
    Layer.succeed(ConnectionBroker, ConnectionBroker.of({ prepare })),
    Layer.succeed(RpcSessionFactory, RpcSessionFactory.of({ connect })),
  );

  return {
    dependencies,
    prepareCount,
    sessionCount,
    releaseCount,
    setNetworkStatus: (status: NetworkStatus) => SubscriptionRef.set(networkStatus, status),
    wake: (reason: "application-active" | "credentials-changed") =>
      SubscriptionRef.update(wakeups, (event) => ({
        sequence: event.sequence + 1,
        reason,
      })),
    closeLatestSession: Effect.fn("TestConnectionHarness.closeLatestSession")(function* (
      error = transient("Session closed."),
    ) {
      const sessions = yield* Ref.get(closedSessions);
      const latest = sessions.at(-1);
      if (latest) {
        yield* Deferred.fail(latest, error);
      }
    }),
  };
});

describe("EnvironmentSupervisor", () => {
  it.effect("does not attempt a connection until it is desired", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness();
      const supervisor = yield* makeEnvironmentSupervisor(TARGET).pipe(
        Effect.provide(harness.dependencies),
      );

      expect((yield* SubscriptionRef.get(supervisor.state))._tag).toBe("Available");
      expect(yield* Ref.get(harness.prepareCount)).toBe(0);
    }),
  );

  it.effect("does not let the initial connect signal cancel the first attempt", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness();
      const supervisor = yield* makeEnvironmentSupervisor(TARGET).pipe(
        Effect.provide(harness.dependencies),
      );

      yield* supervisor.connect;
      yield* awaitState(supervisor.state, (state) => state._tag === "Ready");

      expect(yield* Ref.get(harness.sessionCount)).toBe(1);
      expect(yield* Ref.get(harness.releaseCount)).toBe(0);
    }),
  );

  it.effect("waits while offline and connects immediately when the network returns", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness({ networkStatus: "offline" });
      const supervisor = yield* makeEnvironmentSupervisor(TARGET, {
        initiallyDesired: true,
      }).pipe(Effect.provide(harness.dependencies));

      yield* awaitState(supervisor.state, (state) => state._tag === "Offline");
      expect(yield* Ref.get(harness.prepareCount)).toBe(0);

      yield* harness.setNetworkStatus("online");
      const ready = yield* awaitState(supervisor.state, (state) => state._tag === "Ready");

      expect(ready).toEqual({ _tag: "Ready", attempt: 1, generation: 1 });
      expect(yield* Ref.get(harness.prepareCount)).toBe(1);
    }),
  );

  it.effect("retries forever with exponential backoff capped at sixteen seconds", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness({
        prepare: () => Effect.fail(transient()),
      });
      const supervisor = yield* makeEnvironmentSupervisor(TARGET, {
        initiallyDesired: true,
      }).pipe(Effect.provide(harness.dependencies));

      yield* awaitState(
        supervisor.state,
        (state) => state._tag === "RetryWaiting" && state.attempt === 1,
      );
      expect(yield* Ref.get(harness.prepareCount)).toBe(1);

      for (const [index, delay] of [1_000, 2_000, 4_000, 8_000, 16_000, 16_000].entries()) {
        yield* TestClock.adjust(delay);
        yield* awaitState(
          supervisor.state,
          (state) => state._tag === "RetryWaiting" && state.attempt === index + 2,
        );
      }

      expect(yield* Ref.get(harness.prepareCount)).toBe(7);
    }).pipe(Effect.provide(TestClock.layer())),
  );

  it.effect("retries when a session never becomes ready", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness({
        ready: () => Effect.never,
      });
      const supervisor = yield* makeEnvironmentSupervisor(TARGET, {
        initiallyDesired: true,
      }).pipe(Effect.provide(harness.dependencies));

      yield* awaitState(supervisor.state, (state) => state._tag === "Synchronizing");
      yield* TestClock.adjust("14 seconds");
      expect((yield* SubscriptionRef.get(supervisor.state))._tag).toBe("Synchronizing");

      yield* TestClock.adjust("1 second");
      const retrying = yield* awaitState(
        supervisor.state,
        (state) => state._tag === "RetryWaiting",
      );

      expect(retrying).toMatchObject({
        _tag: "RetryWaiting",
        error: {
          _tag: "ConnectionTransientError",
          reason: "timeout",
          message: "Test environment did not respond during connection setup.",
        },
      });
      expect(yield* Ref.get(harness.releaseCount)).toBe(1);
      expect(Option.isNone(yield* SubscriptionRef.get(supervisor.prepared))).toBe(true);
    }).pipe(Effect.provide(TestClock.layer())),
  );

  it.effect("explicit retry interrupts the current backoff", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness({
        prepare: (attempt) =>
          attempt === 1 ? Effect.fail(transient()) : Effect.succeed(PREPARED_CONNECTION),
      });
      const supervisor = yield* makeEnvironmentSupervisor(TARGET, {
        initiallyDesired: true,
      }).pipe(Effect.provide(harness.dependencies));

      yield* awaitState(supervisor.state, (state) => state._tag === "RetryWaiting");
      yield* supervisor.retryNow;
      yield* awaitState(supervisor.state, (state) => state._tag === "Ready");

      expect(yield* Ref.get(harness.prepareCount)).toBe(2);
    }),
  );

  it.effect("keeps blocked failures idle until an external signal requests another attempt", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness({
        prepare: (attempt) =>
          attempt === 1 ? Effect.fail(blocked()) : Effect.succeed(PREPARED_CONNECTION),
      });
      const supervisor = yield* makeEnvironmentSupervisor(TARGET, {
        initiallyDesired: true,
      }).pipe(Effect.provide(harness.dependencies));

      yield* awaitState(supervisor.state, (state) => state._tag === "Blocked");
      yield* TestClock.adjust("1 hour");
      expect(yield* Ref.get(harness.prepareCount)).toBe(1);

      yield* supervisor.retryNow;
      yield* awaitState(supervisor.state, (state) => state._tag === "Ready");
      expect(yield* Ref.get(harness.prepareCount)).toBe(2);
    }).pipe(Effect.provide(TestClock.layer())),
  );

  it.effect("releases a live session while offline and starts a new generation when online", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness();
      const supervisor = yield* makeEnvironmentSupervisor(TARGET, {
        initiallyDesired: true,
      }).pipe(Effect.provide(harness.dependencies));

      yield* awaitState(
        supervisor.state,
        (state) => state._tag === "Ready" && state.generation === 1,
      );
      yield* harness.setNetworkStatus("offline");
      yield* awaitState(supervisor.state, (state) => state._tag === "Offline");

      expect(yield* Ref.get(harness.releaseCount)).toBe(1);
      expect(Option.isNone(yield* SubscriptionRef.get(supervisor.session))).toBe(true);

      yield* harness.setNetworkStatus("online");
      yield* awaitState(
        supervisor.state,
        (state) => state._tag === "Ready" && state.generation === 2,
      );
      expect(yield* Ref.get(harness.sessionCount)).toBe(2);
    }),
  );

  it.effect("retries a blocked connection when platform credentials change", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness({
        prepare: (attempt) =>
          attempt === 1 ? Effect.fail(blocked()) : Effect.succeed(PREPARED_CONNECTION),
      });
      const supervisor = yield* makeEnvironmentSupervisor(TARGET, {
        initiallyDesired: true,
      }).pipe(Effect.provide(harness.dependencies));

      yield* awaitState(supervisor.state, (state) => state._tag === "Blocked");
      yield* harness.wake("credentials-changed");
      yield* awaitState(supervisor.state, (state) => state._tag === "Ready");

      expect(yield* Ref.get(harness.prepareCount)).toBe(2);
    }),
  );

  it.effect("restarts an in-flight attempt when platform credentials change", () =>
    Effect.gen(function* () {
      const firstAttemptStarted = yield* Deferred.make<void>();
      const harness = yield* makeHarness({
        prepare: (attempt) =>
          attempt === 1
            ? Deferred.succeed(firstAttemptStarted, undefined).pipe(Effect.andThen(Effect.never))
            : Effect.succeed(PREPARED_CONNECTION),
      });
      const supervisor = yield* makeEnvironmentSupervisor(TARGET, {
        initiallyDesired: true,
      }).pipe(Effect.provide(harness.dependencies));

      yield* Deferred.await(firstAttemptStarted);
      yield* harness.wake("credentials-changed");
      yield* awaitState(supervisor.state, (state) => state._tag === "Ready");

      expect(yield* Ref.get(harness.prepareCount)).toBe(2);
      expect(yield* Ref.get(harness.sessionCount)).toBe(1);
    }),
  );

  it.effect("treats an involuntary session close as transient and reconnects", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness();
      const supervisor = yield* makeEnvironmentSupervisor(TARGET, {
        initiallyDesired: true,
      }).pipe(Effect.provide(harness.dependencies));

      yield* awaitState(supervisor.state, (state) => state._tag === "Ready");
      yield* harness.closeLatestSession();
      yield* awaitState(
        supervisor.state,
        (state) => state._tag === "RetryWaiting" && state.attempt === 1,
      );
      expect(Option.isNone(yield* SubscriptionRef.get(supervisor.prepared))).toBe(true);

      yield* TestClock.adjust("1 second");
      yield* awaitState(
        supervisor.state,
        (state) => state._tag === "Ready" && state.generation === 2,
      );

      expect(yield* Ref.get(harness.sessionCount)).toBe(2);
      expect(Option.isSome(yield* SubscriptionRef.get(supervisor.prepared))).toBe(true);
    }).pipe(Effect.provide(TestClock.layer())),
  );

  it.effect("keeps a healthy session when the application becomes active", () =>
    Effect.gen(function* () {
      const probeCount = yield* Ref.make(0);
      const probeCalled = yield* Deferred.make<void>();
      const harness = yield* makeHarness({
        probe: () =>
          Ref.update(probeCount, (count) => count + 1).pipe(
            Effect.andThen(Deferred.succeed(probeCalled, undefined)),
          ),
      });
      const supervisor = yield* makeEnvironmentSupervisor(TARGET, {
        initiallyDesired: true,
      }).pipe(Effect.provide(harness.dependencies));

      yield* awaitState(supervisor.state, (state) => state._tag === "Ready");
      yield* harness.wake("application-active");
      yield* Deferred.await(probeCalled);

      expect(yield* Ref.get(probeCount)).toBe(1);
      expect(yield* Ref.get(harness.sessionCount)).toBe(1);
      expect(yield* Ref.get(harness.releaseCount)).toBe(0);
      expect((yield* SubscriptionRef.get(supervisor.state))._tag).toBe("Ready");
    }),
  );

  it.effect("reconnects when the foreground liveness probe fails", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness({
        probe: (attempt) =>
          attempt === 1 ? Effect.fail(transient("The live session is stale.")) : Effect.void,
      });
      const supervisor = yield* makeEnvironmentSupervisor(TARGET, {
        initiallyDesired: true,
      }).pipe(Effect.provide(harness.dependencies));

      yield* awaitState(supervisor.state, (state) => state._tag === "Ready");
      yield* harness.wake("application-active");
      yield* awaitState(
        supervisor.state,
        (state) => state._tag === "Ready" && state.generation === 2,
      );

      expect(yield* Ref.get(harness.sessionCount)).toBe(2);
      expect(yield* Ref.get(harness.releaseCount)).toBe(1);
    }),
  );

  it.effect("does not churn a healthy session when credentials change", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness();
      const supervisor = yield* makeEnvironmentSupervisor(TARGET, {
        initiallyDesired: true,
      }).pipe(Effect.provide(harness.dependencies));

      yield* awaitState(supervisor.state, (state) => state._tag === "Ready");
      yield* harness.wake("credentials-changed");
      yield* Effect.yieldNow;

      expect(yield* Ref.get(harness.sessionCount)).toBe(1);
      expect(yield* Ref.get(harness.releaseCount)).toBe(0);
      expect((yield* SubscriptionRef.get(supervisor.state))._tag).toBe("Ready");
    }),
  );

  it.effect("explicit disconnect releases the session and returns to available", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness();
      const supervisor = yield* makeEnvironmentSupervisor(TARGET, {
        initiallyDesired: true,
      }).pipe(Effect.provide(harness.dependencies));

      yield* awaitState(supervisor.state, (state) => state._tag === "Ready");
      yield* supervisor.disconnect;
      yield* awaitState(supervisor.state, (state) => state._tag === "Available");

      expect(yield* Ref.get(harness.releaseCount)).toBe(1);
      expect(Option.isNone(yield* SubscriptionRef.get(supervisor.session))).toBe(true);
      expect(Option.isNone(yield* SubscriptionRef.get(supervisor.prepared))).toBe(true);
    }),
  );

  it.effect("does not lose an explicit disconnect among concurrent wakeup signals", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness();
      const supervisor = yield* makeEnvironmentSupervisor(TARGET, {
        initiallyDesired: true,
      }).pipe(Effect.provide(harness.dependencies));

      yield* awaitState(supervisor.state, (state) => state._tag === "Ready");
      yield* Effect.all(
        [
          supervisor.disconnect,
          harness.wake("credentials-changed"),
          harness.wake("application-active"),
          harness.wake("credentials-changed"),
        ],
        { concurrency: "unbounded" },
      );
      yield* awaitState(supervisor.state, (state) => state._tag === "Available");

      expect(yield* Ref.get(harness.releaseCount)).toBe(1);
      expect(Option.isNone(yield* SubscriptionRef.get(supervisor.session))).toBe(true);
    }),
  );
});
