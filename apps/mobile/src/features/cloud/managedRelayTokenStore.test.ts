import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { vi } from "vite-plus/test";

const secureStore = vi.hoisted(() => new Map<string, string>());

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn((key: string) => Promise.resolve(secureStore.get(key) ?? null)),
  setItemAsync: vi.fn((key: string, value: string) => {
    secureStore.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: vi.fn((key: string) => {
    secureStore.delete(key);
    return Promise.resolve();
  }),
}));

import { mobileManagedRelayAccessTokenStore } from "./managedRelayTokenStore";

it.effect("round-trips and clears persisted managed relay access tokens", () =>
  Effect.gen(function* () {
    secureStore.clear();
    const entries = [
      {
        accountId: "user-1",
        clientId: "t3-mobile",
        relayUrl: "https://relay.example.test",
        thumbprint: "thumbprint",
        scopes: ["environment:connect"],
        accessToken: "access-token",
        expiresAtMillis: 1_800_000,
      },
    ] as const;

    yield* mobileManagedRelayAccessTokenStore.save(entries);
    expect(yield* mobileManagedRelayAccessTokenStore.load).toEqual(entries);

    yield* mobileManagedRelayAccessTokenStore.clear;
    expect(yield* mobileManagedRelayAccessTokenStore.load).toEqual([]);
  }),
);

it.effect("falls back to an empty cache when persisted data is invalid", () =>
  Effect.gen(function* () {
    secureStore.clear();
    secureStore.set("t3code.cloud.relay-access-tokens", "not-json");

    expect(yield* mobileManagedRelayAccessTokenStore.load).toEqual([]);
  }),
);
