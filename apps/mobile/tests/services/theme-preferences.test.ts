import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { expect } from "vitest";

import { KeyValueStore } from "@/services/key-value-store";
import { makeStoreOps, memoryStorageAdapter } from "@/services/storage-adapter";
import {
  ThemePreferences,
  ThemePreferencesServiceLive,
  type ThemeValues,
} from "@/services/theme-preferences";

const memoryLayer = (seed?: (data: Map<string, string>) => void): Layer.Layer<KeyValueStore> =>
  Layer.effect(
    KeyValueStore,
    Effect.sync(() => {
      const adapter = memoryStorageAdapter();
      seed?.(adapter.data);
      return KeyValueStore.of(makeStoreOps(adapter));
    }),
  );

const serviceLayer = (seed?: (data: Map<string, string>) => void): Layer.Layer<ThemePreferences> =>
  Layer.provide(ThemePreferencesServiceLive, memoryLayer(seed));

const DEFAULTS: ThemeValues = { accent: "default", density: "regular", mode: "system" };

it.effect("loads the defaults when nothing is stored", () =>
  Effect.gen(function* () {
    const preferences = yield* Effect.service(ThemePreferences);

    expect(yield* preferences.load).toEqual(DEFAULTS);
  }).pipe(Effect.provide(serviceLayer())),
);

it.effect("saves a partial patch and reloads it", () =>
  Effect.gen(function* () {
    const preferences = yield* Effect.service(ThemePreferences);

    yield* preferences.save({ mode: "dark" });

    expect(yield* preferences.load).toEqual({ ...DEFAULTS, mode: "dark" });

    yield* preferences.save({ accent: "teal", density: "compact" });

    expect(yield* preferences.load).toEqual({
      accent: "teal",
      density: "compact",
      mode: "dark",
    });
  }).pipe(Effect.provide(serviceLayer())),
);

it.effect("falls back to the defaults on a corrupt stored value", () =>
  Effect.gen(function* () {
    const preferences = yield* Effect.service(ThemePreferences);

    expect(yield* preferences.load).toEqual(DEFAULTS);
  }).pipe(Effect.provide(serviceLayer((data) => void data.set("theme-preferences", "!!nope")))),
);
