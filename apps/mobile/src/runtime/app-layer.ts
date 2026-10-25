import { Config, Effect, Layer } from "effect";

import { AppLifecycle, AppLifecycleLive } from "@/services/app-lifecycle";
import { Connectivity, ConnectivityLive } from "@/services/connectivity";
import { makeIdempotencyKeys, IdempotencyKeys } from "@/services/idempotency-keys";
import { Haptics, HapticsLive } from "@/services/haptics";
import { makeMobileApiLayer, MobileApi, TokenSource } from "@/services/mobile-api";
import { SecureStorageLive } from "@/services/secure-storage";
import { makeSessionLayer, Session, TokenSourceFromSession } from "@/services/session";
import {
  ThemePreferences,
  ThemePreferencesServiceLive,
} from "@/services/theme-preferences";
import { KeyValueStoreLive } from "@/services/key-value-store";

/** The app origin; Android emulator 10.0.2.2 reaches the host machine. */
const resolveBaseUrl = (): string =>
  process.env.EXPO_PUBLIC_API_URL === undefined || process.env.EXPO_PUBLIC_API_URL.length === 0
    ? "http://10.0.2.2:3000"
    : process.env.EXPO_PUBLIC_API_URL;

void Config;

const SessionLive = Layer.provide(
  makeSessionLayer({ baseUrl: resolveBaseUrl() }),
  SecureStorageLive,
);
const TokenSourceLive = Layer.provide(TokenSourceFromSession, SessionLive);
const MobileApiLive = Layer.provide(
  makeMobileApiLayer({ baseUrl: resolveBaseUrl() }),
  TokenSourceLive,
);
const IdempotencyKeysLive = makeIdempotencyKeys();
const ThemePreferencesLive = Layer.provide(
  ThemePreferencesServiceLive,
  KeyValueStoreLive,
);

/** Every service the app runtime provides. */
export const AppLive = Layer.mergeAll(
  HapticsLive,
  IdempotencyKeysLive,
  SessionLive,
  TokenSourceLive,
  MobileApiLive,
  ThemePreferencesLive,
  ConnectivityLive,
  AppLifecycleLive,
);

export type AppServices =
  | Haptics
  | IdempotencyKeys
  | Session
  | TokenSource
  | MobileApi
  | ThemePreferences
  | Connectivity
  | AppLifecycle;
