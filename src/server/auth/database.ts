import "dotenv/config";
import { Pool } from "pg";

const globalForDatabase = globalThis as typeof globalThis & {
  authPool?: Pool;
};

const databaseUrl = process.env["DATABASE_URL"];

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be configured before starting the server."
  );
}

export const authPool =
  globalForDatabase.authPool ??
  new Pool({
    connectionString: databaseUrl,
    idleTimeoutMillis: 30_000,
    max: Number(process.env["DATABASE_POOL_MAX"] ?? 10),
  });

if (process.env["NODE_ENV"] !== "production") {
  globalForDatabase.authPool = authPool;
}
