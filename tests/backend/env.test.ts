import { describe, expect, it } from "bun:test";

import {
  parseDatabaseEnv,
  parseRetentionEnv,
  parseServerEnv,
} from "../../src/server/core/env";

const validEnv = {
  BETTER_AUTH_SECRET: "a-test-secret-that-is-at-least-thirty-two-chars",
  BETTER_AUTH_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/taskora",
} as const;

const parseError = (source: Record<string, string | undefined>): string => {
  try {
    parseServerEnv(source);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("Expected the environment to be rejected.");
};

describe("parseServerEnv", () => {
  it("accepts the minimal configuration and decodes numbers", () => {
    const env = parseServerEnv({ ...validEnv, DATABASE_POOL_MAX: "5" });

    expect(env.DATABASE_POOL_MAX).toBe(5);
    expect(env.S3_ENDPOINT).toBeUndefined();
  });

  it("treats blank values as unset", () => {
    const env = parseServerEnv({
      ...validEnv,
      S3_ENDPOINT: "",
      VAPID_SUBJECT: " ",
    });

    expect(env.S3_ENDPOINT).toBeUndefined();
    expect(env.VAPID_SUBJECT).toBeUndefined();
  });

  it("names every invalid variable without echoing secret values", () => {
    const message = parseError({
      BETTER_AUTH_SECRET: "too-short-secret",
      DATABASE_POOL_MAX: "0",
      DATABASE_URL: "mysql://localhost/taskora",
      INTAKE_EMAIL_SECRET: "short-intake",
      SCHEDULER_TOKEN: "short-token",
    });

    expect(message).toStartWith("Invalid server environment:");
    for (const name of [
      "BETTER_AUTH_SECRET",
      "DATABASE_POOL_MAX",
      "DATABASE_URL",
      "INTAKE_EMAIL_SECRET",
      "SCHEDULER_TOKEN",
    ]) {
      expect(message).toContain(name);
    }
    expect(message).not.toContain("too-short-secret");
    expect(message).not.toContain("short-token");
  });

  it("requires optional feature groups to be configured together", () => {
    expect(parseError({ ...validEnv, S3_ACCESS_KEY_ID: "key" })).toContain(
      "S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY"
    );
    expect(
      parseError({ ...validEnv, VAPID_PUBLIC_KEY: "public-key" })
    ).toContain("VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT");
  });

  it("refuses the testing API in production outside CI", () => {
    const productionTesting = {
      ...validEnv,
      EXPOSE_TESTING_API: "1",
      NODE_ENV: "production",
    };

    expect(parseError(productionTesting)).toContain("EXPOSE_TESTING_API=1");
    expect(() =>
      parseServerEnv({ ...productionTesting, CI: "true" })
    ).not.toThrow();
    expect(() =>
      parseServerEnv({ ...productionTesting, NODE_ENV: "development" })
    ).not.toThrow();
  });
});

describe("parseDatabaseEnv", () => {
  it("validates the database group without auth or storage settings", () => {
    const env = parseDatabaseEnv({
      DATABASE_STATEMENT_TIMEOUT_MS: "15000",
      DATABASE_URL: validEnv.DATABASE_URL,
    });

    expect(env.DATABASE_STATEMENT_TIMEOUT_MS).toBe(15_000);
    expect(() => parseDatabaseEnv({})).toThrow("DATABASE_URL");
  });
});

describe("parseRetentionEnv", () => {
  it("accepts whole-day retention overrides and rejects nonsense", () => {
    const env = parseRetentionEnv({ RETENTION_DEAD_JOB_DAYS: "45" });

    expect(env.RETENTION_DEAD_JOB_DAYS).toBe(45);
    expect(env.RETENTION_COMPLETED_JOB_DAYS).toBeUndefined();
    expect(() =>
      parseRetentionEnv({ RETENTION_COMPLETED_JOB_DAYS: "0" })
    ).toThrow("RETENTION_COMPLETED_JOB_DAYS");
  });
});
