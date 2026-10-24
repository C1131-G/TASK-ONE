import { Context, Effect, Layer } from "effect";

import {
  makeStoreOps,
  memoryStorageAdapter,
  type StoreOps,
} from "@/services/storage-adapter";

export class SecureStorage extends Context.Service<SecureStorage, StoreOps>()(
  "metsys/mobile/SecureStorage",
) {}

/** expo-secure-store-backed live layer for tokens and secrets. */
export const SecureStorageLive = Layer.effect(
  SecureStorage,
  Effect.flatMap(
    Effect.promise(() => import("expo-secure-store")),
    (secureStore) =>
      Effect.succeed(
        SecureStorage.of(
          makeStoreOps({
            getItem: (key) => secureStore.getItemAsync(key),
            setItem: (key, value) => secureStore.setItemAsync(key, value),
            removeItem: (key) => secureStore.deleteItemAsync(key),
          }),
        ),
      ),
  ),
);

export const SecureStorageMemory = Layer.effect(
  SecureStorage,
  Effect.sync(() => SecureStorage.of(makeStoreOps(memoryStorageAdapter()))),
);
