import { Layer } from "effect";

import { KeyValueStore, KeyValueStoreLive } from "@/services/key-value-store";
import { SecureStorage, SecureStorageLive } from "@/services/secure-storage";

/** Every service the app runtime provides; grows as phases land. */
export const AppLive = Layer.mergeAll(KeyValueStoreLive, SecureStorageLive);

export type AppServices = KeyValueStore | SecureStorage;
