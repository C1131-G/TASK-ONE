import { Context, Effect, Layer, Schema } from "effect";

import { StorageFailure } from "@/errors";
import { KeyValueStore, KeyValueStoreLive } from "@/services/key-value-store";
import type { StoreOps } from "@/services/storage-adapter";
import type { AccentName } from "@/theme/tokens.generated";

export type ThemeMode = "system" | "light" | "dark";
export type DensityName = "regular" | "compact";

export interface ThemeValues {
  readonly mode: ThemeMode;
  readonly accent: AccentName;
  readonly density: DensityName;
}

export const DEFAULT_THEME_VALUES: ThemeValues = {
  accent: "default",
  density: "regular",
  mode: "system",
};

const STORE_KEY = "theme-preferences";

const ValuesCodec = Schema.fromJsonString(
  Schema.Struct({
    accent: Schema.Literals(["default", "blue", "violet", "teal", "rose", "graphite"]),
    density: Schema.Literals(["regular", "compact"]),
    mode: Schema.Literals(["system", "light", "dark"]),
  }),
);

export class ThemePreferences extends Context.Service<
  ThemePreferences,
  {
    /** The stored preferences, or the defaults when nothing valid is stored. */
    readonly load: Effect.Effect<ThemeValues>;
    /** Persists a partial patch, keeping unspecified values. */
    readonly save: (patch: Partial<ThemeValues>) => Effect.Effect<void, StorageFailure>;
  }
>()("taskora/mobile/ThemePreferences") {}

const makePreferences = (store: StoreOps) => {
  const readStored = Effect.flatMap(
    store.read(STORE_KEY, ValuesCodec),
    (stored) => Effect.succeed(stored ?? DEFAULT_THEME_VALUES),
  ).pipe(Effect.catchEager(() => Effect.succeed(DEFAULT_THEME_VALUES)));

  return ThemePreferences.of({
    load: readStored,
    save: (patch) =>
      Effect.flatMap(readStored, (current) =>
        store.write(STORE_KEY, { ...current, ...patch }, ValuesCodec),
      ),
  });
};

/** Requires a KeyValueStore in context. */
export const ThemePreferencesServiceLive = Layer.effect(
  ThemePreferences,
  Effect.map(Effect.service(KeyValueStore), makePreferences),
);

export const ThemePreferencesLive = Layer.provide(
  ThemePreferencesServiceLive,
  KeyValueStoreLive,
);
