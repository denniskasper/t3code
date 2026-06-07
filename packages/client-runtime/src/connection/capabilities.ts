import {
  EnvironmentId,
  type AuthClientPresentationMetadata,
  type AuthEnvironmentScope,
  type DesktopSshEnvironmentBootstrap,
  type DesktopSshEnvironmentTarget,
} from "@t3tools/contracts";
import {
  RelayManagedEndpoint,
  type RelayManagedEndpoint as RelayManagedEndpointType,
} from "@t3tools/contracts/relay";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import type { ConnectionAttemptError } from "./model.ts";

export interface RelayEnvironmentAuthorization {
  readonly environmentId: EnvironmentId;
  readonly endpoint: RelayManagedEndpointType;
  readonly credential: string;
}

export class RemoteDpopAccessToken extends Schema.Class<RemoteDpopAccessToken>(
  "@t3tools/client-runtime/connection/capabilities/RemoteDpopAccessToken",
)({
  environmentId: EnvironmentId,
  label: Schema.String,
  endpoint: RelayManagedEndpoint,
  accessToken: Schema.String,
  expiresAtEpochMs: Schema.Number,
  dpopThumbprint: Schema.String,
}) {}

export interface AuthorizedRemoteEnvironment {
  readonly environmentId: EnvironmentId;
  readonly label: string;
  readonly httpBaseUrl: string;
  readonly socketUrl: string;
}

export interface PreparedSshEnvironment {
  readonly bootstrap: DesktopSshEnvironmentBootstrap;
  readonly bearerToken: string;
}

export interface ProvisionedSshEnvironment extends PreparedSshEnvironment {
  readonly environmentId: EnvironmentId;
  readonly label: string;
}

export class CloudSession extends Context.Service<
  CloudSession,
  {
    readonly clerkToken: Effect.Effect<string, ConnectionAttemptError>;
  }
>()("@t3tools/client-runtime/connection/capabilities/CloudSession") {}

export class RelayDeviceIdentity extends Context.Service<
  RelayDeviceIdentity,
  {
    readonly deviceId: Effect.Effect<Option.Option<string>, ConnectionAttemptError>;
  }
>()("@t3tools/client-runtime/connection/capabilities/RelayDeviceIdentity") {}

export class RemoteDpopAccessTokenStore extends Context.Service<
  RemoteDpopAccessTokenStore,
  {
    readonly get: (
      environmentId: EnvironmentId,
    ) => Effect.Effect<Option.Option<RemoteDpopAccessToken>, ConnectionAttemptError>;
    readonly put: (token: RemoteDpopAccessToken) => Effect.Effect<void, ConnectionAttemptError>;
    readonly remove: (environmentId: EnvironmentId) => Effect.Effect<void, ConnectionAttemptError>;
  }
>()("@t3tools/client-runtime/connection/capabilities/RemoteDpopAccessTokenStore") {}

export class ClientPresentation extends Context.Service<
  ClientPresentation,
  {
    readonly metadata: AuthClientPresentationMetadata;
    readonly scopes: ReadonlyArray<AuthEnvironmentScope>;
  }
>()("@t3tools/client-runtime/connection/capabilities/ClientPresentation") {}

export class RemoteEnvironmentAuthorization extends Context.Service<
  RemoteEnvironmentAuthorization,
  {
    readonly authorizeBearer: (input: {
      readonly expectedEnvironmentId: EnvironmentId;
      readonly httpBaseUrl: string;
      readonly wsBaseUrl: string;
      readonly bearerToken: string;
    }) => Effect.Effect<AuthorizedRemoteEnvironment, ConnectionAttemptError>;
    readonly authorizeDpop: (input: {
      readonly expectedEnvironmentId: EnvironmentId;
      readonly obtainBootstrap: Effect.Effect<
        RelayEnvironmentAuthorization,
        ConnectionAttemptError
      >;
    }) => Effect.Effect<AuthorizedRemoteEnvironment, ConnectionAttemptError>;
  }
>()("@t3tools/client-runtime/connection/capabilities/RemoteEnvironmentAuthorization") {}

export class SshEnvironmentGateway extends Context.Service<
  SshEnvironmentGateway,
  {
    readonly provision: (
      target: DesktopSshEnvironmentTarget,
    ) => Effect.Effect<ProvisionedSshEnvironment, ConnectionAttemptError>;
    readonly prepare: (input: {
      readonly connectionId: string;
      readonly expectedEnvironmentId: EnvironmentId;
      readonly target: DesktopSshEnvironmentTarget;
    }) => Effect.Effect<PreparedSshEnvironment, ConnectionAttemptError>;
    readonly disconnect: (
      target: DesktopSshEnvironmentTarget,
    ) => Effect.Effect<void, ConnectionAttemptError>;
  }
>()("@t3tools/client-runtime/connection/capabilities/SshEnvironmentGateway") {}
