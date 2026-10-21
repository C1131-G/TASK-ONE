import "server-only";
import { authPool } from "../auth/database";
import { isStorageConfigured, probeStorageBucket } from "../storage/storage";
import type { ReadinessProbes } from "./readiness";

const probeDatabase = async (): Promise<void> => {
  await authPool.query("SELECT 1");
};

/** The production dependencies a ready instance must reach. */
export const liveReadinessProbes: ReadinessProbes = isStorageConfigured
  ? { database: probeDatabase, storage: probeStorageBucket }
  : { database: probeDatabase };
