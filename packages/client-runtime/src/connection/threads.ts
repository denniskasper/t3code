import {
  ORCHESTRATION_WS_METHODS,
  type OrchestrationThread,
  type OrchestrationThreadStreamItem,
  type ThreadId,
} from "@t3tools/contracts";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";

import {
  DEFAULT_THREAD_DETAIL_LIMITS,
  applyThreadDetailEvent,
  type ThreadDetailRetentionLimits,
} from "../threadDetailReducer.ts";
import { connectionProjectionPhase } from "./model.ts";
import { EnvironmentCacheStore } from "./persistence.ts";
import type { EnvironmentRpcService } from "./runtime.ts";
import type { EnvironmentSupervisorService } from "./supervisor.ts";

export type EnvironmentThreadStatus = "empty" | "cached" | "synchronizing" | "live" | "deleted";

export interface EnvironmentThreadState {
  readonly data: Option.Option<OrchestrationThread>;
  readonly status: EnvironmentThreadStatus;
  readonly error: Option.Option<string>;
}

export const EMPTY_ENVIRONMENT_THREAD_STATE: EnvironmentThreadState = {
  data: Option.none(),
  status: "empty",
  error: Option.none(),
};

export interface EnvironmentThreadsService {
  readonly changes: (threadId: ThreadId) => Stream.Stream<EnvironmentThreadState>;
}

export class EnvironmentThreads extends Context.Service<
  EnvironmentThreads,
  EnvironmentThreadsService
>()("@t3tools/client-runtime/connection/threads/EnvironmentThreads") {}

function statusWithoutLiveData(data: Option.Option<OrchestrationThread>): EnvironmentThreadStatus {
  return Option.isSome(data) ? "cached" : "empty";
}

function formatThreadError(cause: Cause.Cause<unknown>): string {
  const error = Cause.squash(cause);
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : "Could not synchronize the thread.";
}

const makeThreadResource = Effect.fn("EnvironmentThreads.makeResource")(function* (
  threadId: ThreadId,
  supervisor: EnvironmentSupervisorService,
  rpc: EnvironmentRpcService,
  cache: EnvironmentCacheStore["Service"],
  limits: ThreadDetailRetentionLimits,
) {
  const cached = yield* cache.loadThread(supervisor.target.environmentId, threadId).pipe(
    Effect.catch((error) =>
      Effect.logWarning("Could not load cached thread.").pipe(
        Effect.annotateLogs({
          environmentId: supervisor.target.environmentId,
          threadId,
          error: error.message,
        }),
        Effect.as(Option.none<OrchestrationThread>()),
      ),
    ),
  );
  const state = yield* SubscriptionRef.make<EnvironmentThreadState>({
    data: cached,
    status: statusWithoutLiveData(cached),
    error: Option.none(),
  });
  const persistence = yield* Queue.sliding<OrchestrationThread>(1);

  const persist = Effect.fn("EnvironmentThreads.persist")(function* (thread: OrchestrationThread) {
    yield* cache.saveThread(supervisor.target.environmentId, thread).pipe(
      Effect.catch((error) =>
        Effect.logWarning("Could not persist the thread cache.").pipe(
          Effect.annotateLogs({
            environmentId: supervisor.target.environmentId,
            threadId,
            error: error.message,
          }),
        ),
      ),
    );
  });

  yield* Stream.fromQueue(persistence).pipe(
    Stream.debounce("500 millis"),
    Stream.runForEach(persist),
    Effect.forkScoped,
  );

  const setSynchronizing = SubscriptionRef.update(state, (current) => ({
    ...current,
    status: "synchronizing" as const,
    error: Option.none(),
  }));
  const setReady = SubscriptionRef.update(state, (current) =>
    current.status === "live" || current.status === "deleted"
      ? current
      : {
          ...current,
          status: "synchronizing" as const,
          error: Option.none(),
        },
  );
  const setDisconnected = SubscriptionRef.update(state, (current) => ({
    ...current,
    status: current.status === "deleted" ? current.status : statusWithoutLiveData(current.data),
  }));
  const setStreamError = (cause: Cause.Cause<unknown>) =>
    SubscriptionRef.update(state, (current) => ({
      ...current,
      status: current.status === "deleted" ? current.status : statusWithoutLiveData(current.data),
      error: Option.some(formatThreadError(cause)),
    }));

  const setThread = Effect.fn("EnvironmentThreads.setThread")(function* (
    thread: OrchestrationThread,
  ) {
    yield* SubscriptionRef.set(state, {
      data: Option.some(thread),
      status: "live",
      error: Option.none(),
    });
    yield* Queue.offer(persistence, thread);
  });

  const setDeleted = Effect.fn("EnvironmentThreads.setDeleted")(function* () {
    yield* SubscriptionRef.set(state, {
      data: Option.none(),
      status: "deleted",
      error: Option.none(),
    });
    yield* cache.removeThread(supervisor.target.environmentId, threadId).pipe(
      Effect.catch((error) =>
        Effect.logWarning("Could not remove the cached thread.").pipe(
          Effect.annotateLogs({
            environmentId: supervisor.target.environmentId,
            threadId,
            error: error.message,
          }),
        ),
      ),
    );
  });

  const applyItem = Effect.fn("EnvironmentThreads.applyItem")(function* (
    item: OrchestrationThreadStreamItem,
  ) {
    if (item.kind === "snapshot") {
      yield* setThread(item.snapshot.thread);
      return;
    }

    const current = yield* SubscriptionRef.get(state);
    if (Option.isNone(current.data)) {
      if (item.event.type === "thread.deleted") {
        yield* setDeleted();
      }
      return;
    }
    const result = applyThreadDetailEvent(current.data.value, item.event, limits);
    if (result.kind === "updated") {
      yield* setThread(result.thread);
    } else if (result.kind === "deleted") {
      yield* setDeleted();
    }
  });

  yield* SubscriptionRef.changes(supervisor.state).pipe(
    Stream.runForEach((connectionState) => {
      switch (connectionProjectionPhase(connectionState)) {
        case "synchronizing":
          return setSynchronizing;
        case "disconnected":
          return setDisconnected;
        case "ready":
          return setReady;
      }
    }),
    Effect.forkScoped,
  );

  yield* setSynchronizing;
  yield* rpc
    .subscribe(ORCHESTRATION_WS_METHODS.subscribeThread, {
      threadId,
    })
    .pipe(
      Stream.runForEach(applyItem),
      Effect.catchCause((cause) =>
        Cause.hasInterruptsOnly(cause) ? Effect.interrupt : setStreamError(cause),
      ),
      Effect.forkScoped,
    );

  yield* Effect.addFinalizer(() =>
    SubscriptionRef.get(state).pipe(
      Effect.flatMap((current) =>
        Option.match(current.data, {
          onNone: () => Effect.void,
          onSome: persist,
        }),
      ),
    ),
  );

  return state;
});

export const makeEnvironmentThreads = Effect.fn("EnvironmentThreads.make")(function* (
  supervisor: EnvironmentSupervisorService,
  rpc: EnvironmentRpcService,
  options?: {
    readonly limits?: ThreadDetailRetentionLimits;
  },
) {
  const cache = yield* EnvironmentCacheStore;
  const limits = options?.limits ?? DEFAULT_THREAD_DETAIL_LIMITS;
  const changes = (threadId: ThreadId) =>
    Stream.unwrap(
      makeThreadResource(threadId, supervisor, rpc, cache, limits).pipe(
        Effect.map(SubscriptionRef.changes),
      ),
    );

  return EnvironmentThreads.of({ changes });
});
