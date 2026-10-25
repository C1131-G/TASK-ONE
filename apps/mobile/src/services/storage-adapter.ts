import { Effect, Schema } from "effect";

import { DecodeFailure, StorageFailure } from "@/errors";

/**
 * The foreign storage boundary, wrapped exactly once here. Live adapters
 * delegate to expo-secure-store or AsyncStorage; tests use the in-memory
 * adapter.
 */
export interface StorageAdapter {
  readonly getItem: (key: string) => Promise<string | null>;
  readonly setItem: (key: string, value: string) => Promise<void>;
  readonly removeItem: (key: string) => Promise<void>;
}

/** The storage operations both services expose; values cross the boundary as codec-encoded strings. */
export interface StoreOps {
  readonly read: <TValue>(
    key: string,
    codec: Schema.Codec<TValue, string, never, never>
  ) => Effect.Effect<TValue | null, StorageFailure | DecodeFailure>;
  readonly write: <TValue>(
    key: string,
    value: TValue,
    codec: Schema.Codec<TValue, string, never, never>
  ) => Effect.Effect<void, StorageFailure>;
  readonly remove: (key: string) => Effect.Effect<void, StorageFailure>;
}

export const makeStoreOps = (adapter: StorageAdapter): StoreOps => {
  const getItem = (key: string) =>
    Effect.tryPromise({
      catch: (cause) => new StorageFailure({ cause }),
      try: () => adapter.getItem(key),
    });

  const setItem = (key: string, value: string) =>
    Effect.tryPromise({
      catch: (cause) => new StorageFailure({ cause }),
      try: () => adapter.setItem(key, value),
    });

  const removeItem = (key: string) =>
    Effect.tryPromise({
      catch: (cause) => new StorageFailure({ cause }),
      try: () => adapter.removeItem(key),
    });

  return {
    read: (key, codec) =>
      Effect.flatMap(getItem(key), (stored) =>
        stored === null
          ? Effect.succeed(null)
          : Effect.mapError(
              Schema.decodeUnknownEffect(codec)(stored),
              (cause) => new DecodeFailure({ cause }),
            ),
      ),
    // An invalid in-memory value is a programming error, so encoding dies.
    write: (key, value, codec) =>
      Effect.flatMap(
        Effect.orDie(Schema.encodeEffect(codec)(value)),
        (encoded) => setItem(key, encoded),
      ),
    remove: (key) => Effect.asVoid(removeItem(key)),
  };
};

export interface MemoryStorageAdapter extends StorageAdapter {
  readonly data: Map<string, string>;
}

/** A string-map adapter for tests; seed `data` to stage corrupt or existing values. */
export const memoryStorageAdapter = (
  data = new Map<string, string>(),
): MemoryStorageAdapter => ({
  data,
  getItem: (key) => Promise.resolve(data.get(key) ?? null),
  setItem: (key, value) => {
    data.set(key, value);
    return Promise.resolve();
  },
  removeItem: (key) => {
    data.delete(key);
    return Promise.resolve();
  },
});
