import { describe, expect, it } from "bun:test";
import { createHmac } from "node:crypto";

import "./support/server-only-stub";
import {
  decryptSecret,
  encryptSecret,
  generateSecret,
  secretHint,
  webhookKeyMaterial,
} from "../../src/server/webhooks/webhook-secret";
import {
  signWebhook,
  verifyWebhookSignature,
} from "../../src/server/webhooks/webhook-signing";

const keyMaterial = "test-only-secret-that-is-at-least-thirty-two-characters";

describe("webhook secrets", () => {
  it("generates distinct, prefixed, high-entropy secrets", () => {
    const first = generateSecret();
    const second = generateSecret();
    expect(first.startsWith("whsec_")).toBe(true);
    expect(first.length).toBeGreaterThanOrEqual(40);
    expect(first).not.toBe(second);
  });

  it("round-trips through encryption without storing the plaintext", () => {
    const secret = generateSecret();
    const stored = encryptSecret(secret, keyMaterial);
    expect(stored).not.toContain(secret);
    expect(decryptSecret(stored, keyMaterial)).toBe(secret);
  });

  it("uses a fresh nonce so equal secrets encrypt differently", () => {
    expect(encryptSecret("whsec_same", keyMaterial)).not.toBe(
      encryptSecret("whsec_same", keyMaterial)
    );
  });

  it("refuses a different key and tampered ciphertext", () => {
    const stored = encryptSecret("whsec_value", keyMaterial);
    expect(() => decryptSecret(stored, `${keyMaterial}-other`)).toThrow();
    const tampered = `${stored.slice(0, -2)}${stored.endsWith("AA") ? "BB" : "AA"}`;
    expect(() => decryptSecret(tampered, keyMaterial)).toThrow();
  });

  it("prefers a dedicated key, and ignores an empty one", () => {
    const authSecret = "a".repeat(40);
    expect(webhookKeyMaterial({ BETTER_AUTH_SECRET: authSecret })).toBe(
      authSecret
    );
    expect(
      webhookKeyMaterial({
        BETTER_AUTH_SECRET: authSecret,
        WEBHOOK_ENCRYPTION_KEY: "b".repeat(40),
      })
    ).toBe("b".repeat(40));
    expect(
      webhookKeyMaterial({
        BETTER_AUTH_SECRET: authSecret,
        WEBHOOK_ENCRYPTION_KEY: "  ",
      })
    ).toBe(authSecret);
    expect(() => webhookKeyMaterial({})).toThrow();
  });

  it("shows only the last characters as a hint", () => {
    expect(secretHint("whsec_abcdefghijkl")).toBe("ijkl");
  });
});

describe("webhook signing", () => {
  const body = JSON.stringify({ id: "evt" });

  it("signs timestamp.body with HMAC-SHA256 as v1=hex", () => {
    const expected = createHmac("sha256", "whsec_k")
      .update(`1700000000.${body}`)
      .digest("hex");
    expect(signWebhook("whsec_k", 1_700_000_000, body)).toBe(`v1=${expected}`);
  });

  it("verifies a good signature and rejects altered input", () => {
    const signature = signWebhook("whsec_k", 1_700_000_000, body);
    const now = 1_700_000_100;
    expect(
      verifyWebhookSignature("whsec_k", 1_700_000_000, body, signature, now)
    ).toBe(true);
    expect(
      verifyWebhookSignature("whsec_x", 1_700_000_000, body, signature, now)
    ).toBe(false);
    expect(
      verifyWebhookSignature(
        "whsec_k",
        1_700_000_000,
        `${body} `,
        signature,
        now
      )
    ).toBe(false);
    expect(
      verifyWebhookSignature("whsec_k", 1_700_000_001, body, signature, now)
    ).toBe(false);
  });

  it("rejects a replayed timestamp outside the tolerance", () => {
    const signature = signWebhook("whsec_k", 1_700_000_000, body);
    expect(
      verifyWebhookSignature(
        "whsec_k",
        1_700_000_000,
        body,
        signature,
        1_700_000_000 + 3600
      )
    ).toBe(false);
  });
});
