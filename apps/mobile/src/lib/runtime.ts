import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Socket from "effect/unstable/socket/Socket";

import { remoteHttpClientLayer } from "@t3tools/client-runtime";

import { mobileCryptoLayer } from "../features/cloud/dpop";
import { mobileManagedRelayClientLayer } from "../features/cloud/managedRelayLayer";
import { resolveCloudPublicConfig } from "../features/cloud/publicConfig";
import { installMobileTracing, mobileTracingLayer } from "../features/observability/mobileTracing";

function configuredRelayUrl(): string {
  return resolveCloudPublicConfig().relayUrl ?? "http://relay.invalid";
}

const mobileHttpClientLayer = remoteHttpClientLayer(fetch);
const mobileBaseLayers = [mobileHttpClientLayer, mobileCryptoLayer] as const;
const mobileRuntimeLayers =
  mobileTracingLayer === null
    ? mobileBaseLayers
    : ([...mobileBaseLayers, mobileTracingLayer] as const);
const mobileRelayDependencies =
  mobileTracingLayer === null
    ? Layer.mergeAll(...mobileBaseLayers)
    : Layer.mergeAll(...mobileBaseLayers, mobileTracingLayer);

installMobileTracing();

export const mobileRuntimeLayer = Layer.mergeAll(
  ...mobileRuntimeLayers,
  Socket.layerWebSocketConstructorGlobal,
  mobileManagedRelayClientLayer(configuredRelayUrl()).pipe(Layer.provide(mobileRelayDependencies)),
);

export const mobileRuntime = ManagedRuntime.make(mobileRuntimeLayer);
