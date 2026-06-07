import { type ServerConfig, WS_METHODS } from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schedule from "effect/Schedule";
import type * as Scope from "effect/Scope";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import * as Socket from "effect/unstable/socket/Socket";

import { makeWsRpcProtocolClient, type WsRpcProtocolClient } from "../wsRpcProtocol.ts";
import type {
  ConnectionAttemptError,
  ConnectionTransientError,
  PreparedConnection,
} from "./model.ts";
import {
  ConnectionBlockedError,
  ConnectionTransientError as ConnectionTransientErrorClass,
} from "./model.ts";

export interface RpcSession {
  readonly client: WsRpcProtocolClient;
  readonly initialConfig: Effect.Effect<ServerConfig, ConnectionAttemptError>;
  readonly ready: Effect.Effect<void, ConnectionAttemptError>;
  readonly probe: Effect.Effect<void, ConnectionAttemptError>;
  readonly closed: Effect.Effect<never, ConnectionTransientError>;
}

export class RpcSessionFactory extends Context.Service<
  RpcSessionFactory,
  {
    readonly connect: (
      connection: PreparedConnection,
    ) => Effect.Effect<RpcSession, ConnectionAttemptError, Scope.Scope>;
  }
>()("@t3tools/client-runtime/connection/rpcSession/RpcSessionFactory") {}

type InitialConfigError = Effect.Error<
  ReturnType<WsRpcProtocolClient[typeof WS_METHODS.serverGetConfig]>
>;

function mapInitialConfigError(error: InitialConfigError): ConnectionAttemptError {
  switch (error._tag) {
    case "EnvironmentAuthorizationError":
      return new ConnectionBlockedError({
        reason: "permission",
        message: error.message,
      });
    case "KeybindingsConfigParseError":
    case "ServerSettingsError":
      return new ConnectionTransientErrorClass({
        reason: "remote-unavailable",
        message: error.message,
      });
    case "RpcClientError":
      return new ConnectionTransientErrorClass({
        reason: "transport",
        message: error.message,
      });
  }
}

export const rpcSessionFactoryLayer = Layer.effect(
  RpcSessionFactory,
  Effect.gen(function* () {
    const webSocketConstructor = yield* Socket.WebSocketConstructor;

    const connect = Effect.fn("clientRuntime.connection.rpcSession.connect")(function* (
      connection: PreparedConnection,
    ) {
      yield* Effect.annotateCurrentSpan({
        "connection.environment.id": connection.environmentId,
      });

      const disconnected = yield* Deferred.make<never, ConnectionTransientError>();
      const connectionClosed = new ConnectionTransientErrorClass({
        reason: "transport",
        message: `${connection.label} disconnected.`,
      });
      const hooks = RpcClient.ConnectionHooks.of({
        onConnect: Effect.void,
        onDisconnect: Deferred.fail(disconnected, connectionClosed).pipe(Effect.asVoid),
      });
      const socketLayer = Socket.layerWebSocket(connection.socketUrl).pipe(
        Layer.provide(Layer.succeed(Socket.WebSocketConstructor, webSocketConstructor)),
      );
      const protocolLayer = Layer.effect(
        RpcClient.Protocol,
        RpcClient.makeProtocolSocket({
          retryTransientErrors: false,
          retryPolicy: Schedule.recurs(0),
        }),
      ).pipe(
        Layer.provide(
          Layer.mergeAll(
            socketLayer,
            RpcSerialization.layerJson,
            Layer.succeed(RpcClient.ConnectionHooks, hooks),
          ),
        ),
      );
      const protocolContext = yield* Layer.build(protocolLayer);
      const client = yield* makeWsRpcProtocolClient.pipe(Effect.provide(protocolContext));
      const initialConfig = yield* Effect.cached(
        client[WS_METHODS.serverGetConfig]({}).pipe(
          Effect.mapError(mapInitialConfigError),
          Effect.withSpan("clientRuntime.connection.rpcSession.initialConfig"),
        ),
      );
      const probe = client[WS_METHODS.serverGetConfig]({}).pipe(
        Effect.mapError(mapInitialConfigError),
        Effect.asVoid,
        Effect.withSpan("clientRuntime.connection.rpcSession.probe"),
      );

      return {
        client,
        initialConfig,
        ready: initialConfig.pipe(Effect.asVoid, Effect.raceFirst(Deferred.await(disconnected))),
        probe,
        closed: Deferred.await(disconnected),
      } satisfies RpcSession;
    });

    return RpcSessionFactory.of({ connect });
  }),
);
