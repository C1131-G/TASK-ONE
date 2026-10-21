import { describe, expect, it } from "bun:test";

import { parseServerEnv } from "../../src/server/core/env";

const validEnv = {
  BETTER_AUTH_SECRET: "a-test-secret-that-is-at-least-thirty-two-chars",
  BETTER_AUTH_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/metsys",
} as const;

const smtp = {
  EMAIL_FROM: "Metsys <no-reply@example.com>",
  SMTP_HOST: "smtp.example.com",
  SMTP_PORT: "587",
} as const;

const parseError = (source: Record<string, string | undefined>): string => {
  try {
    parseServerEnv(source);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("Expected the environment to be rejected.");
};

describe("parseServerEnv SMTP settings", () => {
  it("accepts a complete SMTP configuration and decodes the port", () => {
    const env = parseServerEnv({ ...validEnv, ...smtp, SMTP_SECURE: "false" });

    expect(env.SMTP_HOST).toBe("smtp.example.com");
    expect(env.SMTP_PORT).toBe(587);
    expect(env.SMTP_SECURE).toBe("false");
  });

  it("leaves email unconfigured when no SMTP variable is set", () => {
    expect(parseServerEnv(validEnv).SMTP_HOST).toBeUndefined();
  });

  it("requires the host and sender together", () => {
    expect(
      parseError({ ...validEnv, SMTP_HOST: "smtp.example.com" })
    ).toContain("SMTP_HOST and EMAIL_FROM");
  });

  it("requires the credentials as a pair without echoing them", () => {
    const message = parseError({
      ...validEnv,
      ...smtp,
      SMTP_USER: "mailer-user-secret",
    });

    expect(message).toContain("SMTP_USER and SMTP_PASSWORD");
    expect(message).not.toContain("mailer-user-secret");
  });

  it("rejects an out-of-range port", () => {
    expect(parseError({ ...validEnv, ...smtp, SMTP_PORT: "70000" })).toContain(
      "SMTP_PORT"
    );
  });
});
