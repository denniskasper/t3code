import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";

import { connectionBrokerLayer } from "./brokers.ts";
import { environmentRegistryLayer, EnvironmentRegistry } from "./registry.ts";
import { connectionOnboardingLayer } from "./onboarding.ts";
import { PlatformConnectionSource } from "./platformSource.ts";
import { relayEnvironmentDiscoveryLayer } from "./relayDiscovery.ts";
import { remoteEnvironmentAuthorizationLayer } from "./remoteAuthorization.ts";
import { rpcSessionFactoryLayer } from "./rpcSession.ts";
import { environmentRuntimeFactoryLayer } from "./runtime.ts";

const brokerLayer = connectionBrokerLayer.pipe(Layer.provide(remoteEnvironmentAuthorizationLayer));

const runtimeFactoryLayer = environmentRuntimeFactoryLayer.pipe(
  Layer.provide(Layer.mergeAll(brokerLayer, rpcSessionFactoryLayer)),
);

const registryLayer = environmentRegistryLayer.pipe(Layer.provide(runtimeFactoryLayer));

const onboardingLayer = connectionOnboardingLayer.pipe(Layer.provide(registryLayer));

const connectionServicesLayer = Layer.mergeAll(
  registryLayer,
  relayEnvironmentDiscoveryLayer,
  onboardingLayer,
);

const connectionStartupLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const registry = yield* EnvironmentRegistry;
    const platformSource = yield* PlatformConnectionSource;
    yield* registry.start;
    yield* platformSource.registrations.pipe(
      Stream.runForEach(registry.registerPlatform),
      Effect.forkScoped,
    );
  }).pipe(Effect.withSpan("clientRuntime.connection.application.start")),
).pipe(Layer.provide(connectionServicesLayer));

export const connectionApplicationLayer = Layer.merge(
  connectionServicesLayer,
  connectionStartupLayer,
);
