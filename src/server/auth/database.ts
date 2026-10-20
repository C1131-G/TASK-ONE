import "server-only";
import "dotenv/config";
import { Pool } from "pg";

import { parseDatabaseEnv } from "../core/env";
import { logger } from "../core/logger";

declare global {
  var authPool: Pool | undefined;
}

const DEFAULT_POOL_MAX = 10;
const DEFAULT_CONNECTION_TIMEOUT_MS = 10_000;
const DEFAULT_STATEMENT_TIMEOUT_MS = 30_000;
const DEFAULT_IDLE_IN_TRANSACTION_TIMEOUT_MS = 60_000;

const createPool = (): Pool => {
  const env = parseDatabaseEnv();
  // Every wait is bounded so a stalled database surfaces as an error instead
  // of a request or worker batch that hangs forever.
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis:
      env.DATABASE_CONNECTION_TIMEOUT_MS ?? DEFAULT_CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: 30_000,
    idle_in_transaction_session_timeout:
      env.DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS ??
      DEFAULT_IDLE_IN_TRANSACTION_TIMEOUT_MS,
    max: env.DATABASE_POOL_MAX ?? DEFAULT_POOL_MAX,
    statement_timeout:
      env.DATABASE_STATEMENT_TIMEOUT_MS ?? DEFAULT_STATEMENT_TIMEOUT_MS,
  });
  // An idle client losing its connection emits "error" on the pool; without a
  // listener Node treats it as unhandled and crashes the process.
  pool.on("error", (error) => {
    logger.error("An idle database connection failed.", { error });
  });
  return pool;
};

export const authPool = globalThis.authPool ?? createPool();

if (process.env["NODE_ENV"] !== "production") {
  globalThis.authPool = authPool;
}
