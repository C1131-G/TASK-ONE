import { Effect, Layer, ManagedRuntime } from "effect";

import type { AppServices } from "./app-layer";
import { makeAppLifecycleTest, AppLifecycle } from "@/services/app-lifecycle";
import { makeConnectivityTest, Connectivity } from "@/services/connectivity";
import { SecureStorageMemory } from "@/services/secure-storage";
import { makeSessionLayer, TokenSourceFromSession } from "@/services/session";
import { makeIdempotencyKeys } from "@/services/idempotency-keys";
import { makeMobileApiLayer } from "@/services/mobile-api";
import {
  ThemePreferencesServiceLive as ThemePreferencesTestLive,
} from "@/services/theme-preferences";
import { KeyValueStoreMemory } from "@/services/key-value-store";

const SessionTestLive = Layer.provide(
  makeSessionLayer({ baseUrl: "https://unit.test" }),
  SecureStorageMemory,
);
const TokenSourceTestLive = Layer.provide(TokenSourceFromSession, SessionTestLive);

/** The combined in-memory layers the vitest suites provide instead of AppLive. */
export const AppTestLive = Layer.mergeAll(
  makeIdempotencyKeys(),
  SessionTestLive,
  TokenSourceTestLive,
  Layer.provide(makeMobileApiLayer({ baseUrl: "https://unit.test" }), TokenSourceTestLive),
  Layer.provide(ThemePreferencesTestLive, KeyValueStoreMemory),
  SecureStorageMemory,
  Layer.effect(Connectivity, Effect.map(makeConnectivityTest(), (service) => service)),
  Layer.effect(AppLifecycle, Effect.map(makeAppLifecycleTest(), (service) => service)),
);

export const makeTestRuntime = (): ManagedRuntime.ManagedRuntime<AppServices, never> =>
  ManagedRuntime.make(AppTestLive);
