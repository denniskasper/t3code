import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";

import { Connectivity } from "./connectivity.ts";
import { ConnectionBroker } from "./broker.ts";
import {
  AVAILABLE_CONNECTION_STATE,
  type ConnectionAttemptError,
  type ConnectionTarget,
  ConnectionTransientError,
  type PreparedConnection,
  type SupervisorConnectionState,
} from "./model.ts";
import { RpcSessionFactory, type RpcSession } from "./rpcSession.ts";
import { type ConnectionWakeup, ConnectionWakeups } from "./wakeups.ts";

const RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000] as const;
const CONNECTION_READY_TIMEOUT = "15 seconds";

type SupervisorSignal =
  | { readonly _tag: "ConnectRequested" }
  | { readonly _tag: "DisconnectRequested" }
  | { readonly _tag: "RetryRequested" }
  | { readonly _tag: "ConnectivityChanged" }
  | { readonly _tag: "Wakeup"; readonly reason: ConnectionWakeup };

export interface EnvironmentSupervisorOptions {
  readonly initiallyDesired?: boolean;
}

export interface EnvironmentSupervisorService {
  readonly target: ConnectionTarget;
  readonly state: SubscriptionRef.SubscriptionRef<SupervisorConnectionState>;
  readonly session: SubscriptionRef.SubscriptionRef<Option.Option<RpcSession>>;
  readonly prepared: SubscriptionRef.SubscriptionRef<Option.Option<PreparedConnection>>;
  readonly connect: Effect.Effect<void>;
  readonly disconnect: Effect.Effect<void>;
  readonly retryNow: Effect.Effect<void>;
}

function retryDelayMs(failureCount: number): number {
  return RETRY_DELAYS_MS[Math.min(failureCount, RETRY_DELAYS_MS.length - 1)] ?? 16_000;
}

function annotateTarget(target: ConnectionTarget) {
  return Effect.annotateCurrentSpan({
    "environment.id": target.environmentId,
    "environment.label": target.label,
    "environment.target.kind": target._tag,
  });
}

export class EnvironmentSupervisor extends Context.Service<
  EnvironmentSupervisor,
  EnvironmentSupervisorService
>()("@t3tools/client-runtime/connection/supervisor/EnvironmentSupervisor") {
  static layer(
    target: ConnectionTarget,
    options?: EnvironmentSupervisorOptions,
  ): Layer.Layer<
    EnvironmentSupervisor,
    never,
    Connectivity | ConnectionBroker | RpcSessionFactory | ConnectionWakeups
  > {
    return Layer.effect(EnvironmentSupervisor, makeEnvironmentSupervisor(target, options));
  }
}

export const makeEnvironmentSupervisor = Effect.fn("EnvironmentSupervisor.make")(function* (
  target: ConnectionTarget,
  options?: EnvironmentSupervisorOptions,
): Effect.fn.Return<
  EnvironmentSupervisorService,
  never,
  Connectivity | ConnectionBroker | RpcSessionFactory | Scope.Scope | ConnectionWakeups
> {
  yield* annotateTarget(target);

  const connectivity = yield* Connectivity;
  const wakeups = yield* ConnectionWakeups;
  const observedNetworkStatus = yield* Ref.make(yield* connectivity.status);
  const broker = yield* ConnectionBroker;
  const sessionFactory = yield* RpcSessionFactory;
  const state = yield* SubscriptionRef.make<SupervisorConnectionState>(AVAILABLE_CONNECTION_STATE);
  const session = yield* SubscriptionRef.make<Option.Option<RpcSession>>(Option.none());
  const prepared = yield* SubscriptionRef.make<Option.Option<PreparedConnection>>(Option.none());
  const desired = yield* Ref.make(options?.initiallyDesired ?? false);
  const signals = yield* Queue.unbounded<SupervisorSignal>();

  const signal = Effect.fn("EnvironmentSupervisor.signal")(function* (next: SupervisorSignal) {
    yield* Queue.offer(signals, next);
  });

  const setState = Effect.fn("EnvironmentSupervisor.setState")(function* (
    next: SupervisorConnectionState,
  ) {
    yield* SubscriptionRef.set(state, next);
  });

  const waitForSignal = Queue.take(signals);

  const drainSignals = Effect.fn("EnvironmentSupervisor.drainSignals")(function* () {
    while (Option.isSome(yield* Queue.poll(signals))) {
      // Drain stale wakeups before beginning the next connection attempt.
    }
  });

  const waitForAttemptInterrupt = Effect.fn("EnvironmentSupervisor.waitForAttemptInterrupt")(
    function* () {
      for (;;) {
        const next = yield* waitForSignal;
        switch (next._tag) {
          case "DisconnectRequested":
          case "RetryRequested":
            return;
          case "ConnectivityChanged":
            if ((yield* connectivity.status) === "offline") {
              return;
            }
            break;
          case "Wakeup":
            const activeSession = yield* SubscriptionRef.get(session);
            if (Option.isNone(activeSession)) {
              return;
            }

            if (next.reason === "credentials-changed") {
              break;
            }

            if (yield* activeSession.value.probe.pipe(Effect.isFailure)) {
              return;
            }
            break;
          case "ConnectRequested":
            break;
        }
      }
    },
  );

  const waitWhileUnavailable = Effect.fn("EnvironmentSupervisor.waitWhileUnavailable")(
    function* () {
      for (;;) {
        if (!(yield* Ref.get(desired))) {
          yield* setState(AVAILABLE_CONNECTION_STATE);
          yield* waitForSignal;
          continue;
        }

        if ((yield* connectivity.status) === "offline") {
          yield* setState({ _tag: "Offline" });
          yield* waitForSignal;
          continue;
        }

        return;
      }
    },
  );

  const runConnectionAttempt = Effect.fn("EnvironmentSupervisor.runConnectionAttempt")(
    function* (attempt: number, generation: number) {
      yield* SubscriptionRef.set(prepared, Option.none());
      yield* setState({ _tag: "Resolving", attempt });
      const nextPrepared = yield* broker.prepare(target);
      yield* SubscriptionRef.set(prepared, Option.some(nextPrepared));
      yield* setState({ _tag: "Connecting", attempt });
      const activeSession = yield* sessionFactory.connect(nextPrepared);
      yield* setState({ _tag: "Synchronizing", attempt });
      yield* activeSession.ready.pipe(
        Effect.timeoutOption(CONNECTION_READY_TIMEOUT),
        Effect.flatMap(
          Option.match({
            onNone: () =>
              Effect.fail(
                new ConnectionTransientError({
                  reason: "timeout",
                  message: `${target.label} did not respond during connection setup.`,
                }),
              ),
            onSome: Effect.succeed,
          }),
        ),
      );
      yield* SubscriptionRef.set(session, Option.some(activeSession));
      yield* setState({ _tag: "Ready", attempt, generation });

      return yield* activeSession.closed;
    },
    Effect.ensuring(
      Effect.all(
        [SubscriptionRef.set(session, Option.none()), SubscriptionRef.set(prepared, Option.none())],
        { discard: true },
      ),
    ),
  );

  const run = Effect.fn("EnvironmentSupervisor.run")(function* () {
    yield* annotateTarget(target);
    let failureCount = 0;
    let generation = 0;

    for (;;) {
      yield* waitWhileUnavailable();
      yield* drainSignals();
      yield* waitWhileUnavailable();

      const attempt = failureCount + 1;
      const result = yield* Effect.raceFirst(
        Effect.scoped(runConnectionAttempt(attempt, generation + 1)),
        waitForAttemptInterrupt(),
      ).pipe(Effect.result);

      const currentState = yield* SubscriptionRef.get(state);
      if (currentState._tag === "Ready") {
        generation = currentState.generation;
        failureCount = 0;
      }

      if (Result.isSuccess(result)) {
        continue;
      }

      const error: ConnectionAttemptError = result.failure;
      if (error._tag === "ConnectionBlockedError") {
        yield* setState({ _tag: "Blocked", error });
        yield* waitForSignal;
        continue;
      }

      failureCount += 1;
      const delayMs = retryDelayMs(failureCount - 1);
      const now = yield* Clock.currentTimeMillis;
      yield* setState({
        _tag: "RetryWaiting",
        attempt,
        retryAt: now + delayMs,
        error,
      });

      yield* Effect.raceFirst(Effect.sleep(delayMs), waitForSignal);
    }
  });

  yield* connectivity.changes.pipe(
    Stream.changes,
    Stream.runForEach((networkStatus) =>
      Ref.getAndSet(observedNetworkStatus, networkStatus).pipe(
        Effect.flatMap((previousNetworkStatus) =>
          previousNetworkStatus === networkStatus
            ? Effect.void
            : signal({ _tag: "ConnectivityChanged" }),
        ),
      ),
    ),
    Effect.forkScoped,
  );
  yield* wakeups.changes.pipe(
    Stream.runForEach((reason) => signal({ _tag: "Wakeup", reason })),
    Effect.forkScoped,
  );
  yield* run().pipe(Effect.forkScoped);

  const connect = Effect.gen(function* () {
    yield* Ref.set(desired, true);
    yield* signal({ _tag: "ConnectRequested" });
  }).pipe(Effect.withSpan("EnvironmentSupervisor.connect"));

  const disconnect = Effect.gen(function* () {
    yield* Ref.set(desired, false);
    yield* signal({ _tag: "DisconnectRequested" });
  }).pipe(Effect.withSpan("EnvironmentSupervisor.disconnect"));

  const retryNow = signal({ _tag: "RetryRequested" });

  yield* Effect.addFinalizer(() =>
    Queue.shutdown(signals).pipe(Effect.andThen(SubscriptionRef.set(session, Option.none()))),
  );

  return EnvironmentSupervisor.of({
    target,
    state,
    session,
    prepared,
    connect,
    disconnect,
    retryNow,
  });
});
