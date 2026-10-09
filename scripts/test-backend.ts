import "dotenv/config";
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Pool } from "pg";

const sourceUrl =
  process.env["TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"];
if (!sourceUrl) {
  throw new Error(
    "Set DATABASE_URL or TEST_DATABASE_URL before running backend tests."
  );
}

const testUrl = new URL(sourceUrl);
let databaseName = decodeURIComponent(testUrl.pathname.slice(1));
if (!process.env["TEST_DATABASE_URL"]) {
  const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(
    testUrl.hostname
  );
  if (!isLocalHost || !databaseName.startsWith("metsys")) {
    throw new Error(
      "Set TEST_DATABASE_URL to a dedicated metsys_test database; refusing to run against a non-local database."
    );
  }
  databaseName = `${databaseName.endsWith("_test") ? databaseName.slice(0, -5) : databaseName}_test`;
  testUrl.pathname = `/${databaseName}`;
}

const hasSafeTestDatabaseName =
  databaseName.startsWith("metsys") &&
  databaseName.endsWith("_test") &&
  [...databaseName].every((character) =>
    "abcdefghijklmnopqrstuvwxyz0123456789_".includes(character)
  );
if (!hasSafeTestDatabaseName) {
  throw new Error(
    "TEST_DATABASE_URL must point to a database named metsys*_test."
  );
}

const adminUrl = new URL(process.env["TEST_DATABASE_ADMIN_URL"] ?? testUrl);
adminUrl.pathname = "/postgres";
const adminPool = new Pool({ connectionString: adminUrl.toString(), max: 1 });
try {
  const exists = await adminPool.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
    [databaseName]
  );
  if (!exists.rows[0]?.exists) {
    await adminPool.query(`CREATE DATABASE "${databaseName}"`);
  }
} finally {
  await adminPool.end();
}

const environment = {
  ...process.env,
  BETTER_AUTH_SECRET:
    process.env["TEST_BETTER_AUTH_SECRET"] ??
    "test-only-secret-that-is-at-least-thirty-two-characters",
  BETTER_AUTH_URL: process.env["BETTER_AUTH_URL"] ?? "http://localhost:3000",
  DATABASE_URL: testUrl.toString(),
  TEST_DATABASE_URL: testUrl.toString(),
};

const migration = spawnSync("bun", ["run", "db:migrate"], {
  env: environment,
  stdio: "inherit",
});
if (migration.status !== 0) {
  process.exit(migration.status ?? 1);
}

const verification = spawnSync("bun", ["run", "db:verify"], {
  env: environment,
  stdio: "inherit",
});
if (verification.status !== 0) {
  process.exit(verification.status ?? 1);
}

const testDirectory = fileURLToPath(
  new URL("../tests/backend", import.meta.url)
);
const testFiles = readdirSync(testDirectory)
  .filter((file) => file.endsWith(".test.ts"))
  .toSorted();

// Tables that legitimately change outside a test's own fixtures: the company
// singleton, auth rate-limit counters, and verification tokens.
const RESIDUE_IGNORED_TABLES = new Set([
  "company_settings",
  "rateLimit",
  "verification",
]);
const residuePool = new Pool({ connectionString: testUrl.toString(), max: 1 });

const countRows = async (): Promise<Map<string, number>> => {
  const tables = await residuePool.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
  );
  const names = tables.rows
    .map(({ table_name: name }) => name)
    .filter((name) => !RESIDUE_IGNORED_TABLES.has(name));
  const counts = await Promise.all(
    names.map(async (name) => {
      const result = await residuePool.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM "${name}"`
      );
      return [name, result.rows[0]?.count ?? 0] as const;
    })
  );
  return new Map(counts);
};

try {
  for (const testFile of testFiles) {
    // Files run one at a time so each file's row delta is its own.
    // eslint-disable-next-line no-await-in-loop
    const before = await countRows();
    const testRun = spawnSync(
      "bun",
      ["test", "--max-concurrency=1", path.join(testDirectory, testFile)],
      { env: environment, stdio: "inherit" }
    );
    if (testRun.status !== 0) {
      process.exit(testRun.status ?? 1);
    }
    // eslint-disable-next-line no-await-in-loop
    const after = await countRows();
    const residue = [...after]
      .filter(([table, count]) => count > (before.get(table) ?? 0))
      .map(([table, count]) => `${table} +${count - (before.get(table) ?? 0)}`);
    if (residue.length > 0 && process.env["ALLOW_TEST_RESIDUE"] !== "1") {
      console.error(
        `${testFile} left rows behind (${residue.join(", ")}). Clean them up in the test's finally block.`
      );
      process.exit(1);
    }
  }
} finally {
  await residuePool.end();
}
