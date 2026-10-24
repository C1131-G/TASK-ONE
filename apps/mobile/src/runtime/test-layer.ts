import { Layer, ManagedRuntime } from "effect";

import type { AppServices } from "./app-layer";
import { KeyValueStoreMemory } from "@/services/key-value-store";
import { SecureStorageMemory } from "@/services/secure-storage";

/** The combined in-memory layers the vitest suites provide instead of AppLive. */
export const AppTestLive = Layer.mergeAll(KeyValueStoreMemory, SecureStorageMemory);

export const makeTestRuntime = (): ManagedRuntime.ManagedRuntime<AppServices, never> =>
  ManagedRuntime.make(AppTestLive);
