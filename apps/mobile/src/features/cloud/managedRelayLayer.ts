import {
  managedRelayClientLayer,
  ManagedRelayDpopSigner,
  ManagedRelayDpopSignerError,
} from "@t3tools/client-runtime";
import { RelayMobileClientId } from "@t3tools/contracts/relay";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { createDpopProof, loadOrCreateDpopProofKeyPair } from "./dpop";
import { mobileManagedRelayAccessTokenStore } from "./managedRelayTokenStore";

const mobileRelayDpopSignerLayer = Layer.effect(
  ManagedRelayDpopSigner,
  Effect.gen(function* () {
    const crypto = yield* Crypto.Crypto;
    const loadProofKey = yield* Effect.cached(
      loadOrCreateDpopProofKeyPair().pipe(Effect.provideService(Crypto.Crypto, crypto)),
    );
    return ManagedRelayDpopSigner.of({
      thumbprint: loadProofKey.pipe(
        Effect.map((proofKey) => proofKey.thumbprint),
        Effect.mapError((cause) => new ManagedRelayDpopSignerError({ cause })),
        Effect.withSpan("mobile.managedRelayDpopSigner.loadThumbprint"),
      ),
      createProof: Effect.fn("mobile.managedRelayDpopSigner.createProof")(
        function* (input) {
          const proofKey = yield* loadProofKey;
          return yield* createDpopProof({ ...input, proofKey }).pipe(
            Effect.provideService(Crypto.Crypto, crypto),
            Effect.map((proof) => proof.proof),
          );
        },
        Effect.mapError((cause) => new ManagedRelayDpopSignerError({ cause })),
      ),
    });
  }),
);

export const mobileManagedRelayClientLayer = (relayUrl: string) =>
  managedRelayClientLayer({
    relayUrl,
    clientId: RelayMobileClientId,
    accessTokenStore: mobileManagedRelayAccessTokenStore,
  }).pipe(Layer.provideMerge(mobileRelayDpopSignerLayer));
