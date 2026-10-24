import { Layer, ManagedRuntime } from "effect";

import type { AppServices } from "./app-layer";
import { KeyValueStoreMemory } from "@/services/key-value-store";
import { SecureStorageMemory } from "@/services/secure-storage";
import { ThemePreferencesServiceLive } from "@/services/theme-preferences";

/** The combined in-memory layers the vitest suites provide instead of AppLive. */
export const AppTestLive = Layer.provide(
  Layer.mergeAll(ThemePreferencesServiceLive, SecureStorageMemory),
  KeyValueStoreMemory,
);

export const makeTestRuntime = (): ManagedRuntime.ManagedRuntime<AppServices, never> =>
  ManagedRuntime.make(AppTestLive);
