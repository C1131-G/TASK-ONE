import { Context, Effect, Layer } from "effect";

import {
  makeStoreOps,
  memoryStorageAdapter,
  type StoreOps,
} from "@/services/storage-adapter";

export class KeyValueStore extends Context.Service<KeyValueStore, StoreOps>()(
  "taskora/mobile/KeyValueStore",
) {}

/** AsyncStorage-backed live layer. The module import is deferred so Node tests never touch it. */
export const KeyValueStoreLive = Layer.effect(
  KeyValueStore,
  Effect.flatMap(
    Effect.promise(() => import("@react-native-async-storage/async-storage")),
    (asyncStorage) => {
      const native = asyncStorage.default;
      return Effect.succeed(
        KeyValueStore.of(
          makeStoreOps({
            getItem: (key) => native.getItem(key),
            setItem: (key, value) => native.setItem(key, value),
            removeItem: (key) => native.removeItem(key),
          }),
        ),
      );
    },
  ),
);

export const KeyValueStoreMemory = Layer.effect(
  KeyValueStore,
  Effect.sync(() => KeyValueStore.of(makeStoreOps(memoryStorageAdapter()))),
);
