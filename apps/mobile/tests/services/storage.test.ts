import { it } from "@effect/vitest";
import { Cause, Effect, Exit, Option, Schema } from "effect";
import { expect } from "vitest";

import { KeyValueStore, KeyValueStoreMemory } from "@/services/key-value-store";
import { SecureStorage, SecureStorageMemory } from "@/services/secure-storage";
import {
  type StorageAdapter,
  makeStoreOps,
  memoryStorageAdapter,
} from "@/services/storage-adapter";
import type { AppFailure } from "@/errors";

const ThemeCodec = Schema.fromJsonString(
  Schema.Struct({ mode: Schema.Literals(["system", "light", "dark"]) }),
);

const failingAdapter = (): StorageAdapter => ({
  getItem: () => Promise.reject(new Error("adapter down")),
  setItem: () => Promise.reject(new Error("adapter down")),
  removeItem: () => Promise.reject(new Error("adapter down")),
});

const exitTag = (exit: Exit.Exit<unknown, AppFailure>): string | null =>
  Exit.isSuccess(exit)
    ? null
    : Option.getOrUndefined(Cause.findErrorOption(exit.cause))?._tag ?? null;

it.effect("reads a missing key as null", () =>
  Effect.gen(function* () {
    const store = yield* Effect.service(KeyValueStore);

    expect(yield* store.read("theme", ThemeCodec)).toBeNull();
  }).pipe(Effect.provide(KeyValueStoreMemory)),
);

it.effect("round-trips a value through its codec", () =>
  Effect.gen(function* () {
    const store = yield* Effect.service(KeyValueStore);

    yield* store.write("theme", { mode: "dark" }, ThemeCodec);

    expect(yield* store.read("theme", ThemeCodec)).toEqual({ mode: "dark" });
  }).pipe(Effect.provide(KeyValueStoreMemory)),
);

it.effect("removes a stored value", () =>
  Effect.gen(function* () {
    const store = yield* Effect.service(KeyValueStore);

    yield* store.write("theme", { mode: "light" }, ThemeCodec);
    yield* store.remove("theme");

    expect(yield* store.read("theme", ThemeCodec)).toBeNull();
  }).pipe(Effect.provide(KeyValueStoreMemory)),
);

it.effect("reads a corrupt stored value as DecodeFailure", () =>
  Effect.gen(function* () {
    const data = memoryStorageAdapter();
    data.data.set("theme", "{ not json");
    const store = KeyValueStore.of(makeStoreOps(data));

    const exit = yield* Effect.exit(store.read("theme", ThemeCodec));

    expect(exitTag(exit)).toBe("DecodeFailure");
  }),
);

it.effect("maps an adapter failure to StorageFailure", () =>
  Effect.gen(function* () {
    const store = KeyValueStore.of(makeStoreOps(failingAdapter()));

    const exit = yield* Effect.exit(store.read("theme", ThemeCodec));

    expect(exitTag(exit)).toBe("StorageFailure");
  }),
);

it.effect("secure storage behaves like key-value storage", () =>
  Effect.gen(function* () {
    const store = yield* Effect.service(SecureStorage);

    yield* store.write("session", { mode: "system" }, ThemeCodec);

    expect(yield* store.read("session", ThemeCodec)).toEqual({ mode: "system" });
  }).pipe(Effect.provide(SecureStorageMemory)),
);
