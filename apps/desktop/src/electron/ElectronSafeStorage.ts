import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as Electron from "electron";

import {
  ElectronSafeStorage,
  ElectronSafeStorageAvailabilityError,
  ElectronSafeStorageDecryptError,
  ElectronSafeStorageEncryptError,
} from "./ElectronSafeStorageService.ts";

export * from "./ElectronSafeStorageService.ts";

const make = ElectronSafeStorage.of({
  isEncryptionAvailable: Effect.try({
    try: () => Electron.safeStorage.isEncryptionAvailable(),
    catch: (cause) => new ElectronSafeStorageAvailabilityError({ cause }),
  }),
  encryptString: (value) =>
    Effect.try({
      try: () => Electron.safeStorage.encryptString(value),
      catch: (cause) => new ElectronSafeStorageEncryptError({ cause }),
    }),
  decryptString: (value) =>
    Effect.try({
      try: () => Electron.safeStorage.decryptString(Buffer.from(value)),
      catch: (cause) => new ElectronSafeStorageDecryptError({ cause }),
    }),
});

export const layer = Layer.succeed(ElectronSafeStorage, make);
