import "dotenv/config";
import { Schema } from "effect";
import { Pool } from "pg";

declare global {
  var authPool: Pool | undefined;
}

const databaseUrl = process.env["DATABASE_URL"];

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be configured before starting the server."
  );
}

const poolMaxSchema = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(1),
  Schema.isLessThanOrEqualTo(100)
);
const poolMax = Schema.decodeUnknownSync(poolMaxSchema)(
  Number(process.env["DATABASE_POOL_MAX"] ?? 10)
);

export const authPool =
  globalThis.authPool ??
  new Pool({
    connectionString: databaseUrl,
    idleTimeoutMillis: 30_000,
    max: poolMax,
  });

if (process.env["NODE_ENV"] !== "production") {
  globalThis.authPool = authPool;
}
