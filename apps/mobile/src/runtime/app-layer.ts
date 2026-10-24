import { Layer } from "effect";

import { KeyValueStoreLive } from "@/services/key-value-store";
import { SecureStorage, SecureStorageLive } from "@/services/secure-storage";
import {
  ThemePreferences,
  ThemePreferencesServiceLive,
} from "@/services/theme-preferences";

/**
 * Every service the app runtime provides, over one shared KeyValueStore;
 * grows as phases land.
 */
export const AppLive = Layer.provide(
  Layer.mergeAll(ThemePreferencesServiceLive, SecureStorageLive),
  KeyValueStoreLive,
);

export type AppServices = SecureStorage | ThemePreferences;
