import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

// Signing needs the raw secret, so it is stored encrypted (AES-256-GCM) under
// a key derived from WEBHOOK_ENCRYPTION_KEY, or BETTER_AUTH_SECRET when that
// is not set. The raw value is shown to the admin once and never read back.

const SECRET_PREFIX = "whsec_";
const SECRET_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const HINT_LENGTH = 4;
const FORMAT = "v1";
const KEY_INFO = "taskora.webhook.secret.v1";

export const generateSecret = (): string =>
  `${SECRET_PREFIX}${randomBytes(SECRET_BYTES).toString("base64url")}`;

export const secretHint = (secret: string): string =>
  secret.slice(-HINT_LENGTH);

const deriveKey = (keyMaterial: string): Buffer =>
  Buffer.from(
    hkdfSync("sha256", keyMaterial, "taskora-webhooks", KEY_INFO, KEY_BYTES)
  );

export const encryptSecret = (secret: string, keyMaterial: string): string => {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(keyMaterial), iv);
  const body = Buffer.concat([cipher.update(secret, "utf-8"), cipher.final()]);
  const packed = Buffer.concat([iv, cipher.getAuthTag(), body]);
  return `${FORMAT}.${packed.toString("base64url")}`;
};

export const decryptSecret = (stored: string, keyMaterial: string): string => {
  const [format, encoded] = stored.split(".");
  if (format !== FORMAT || !encoded) {
    throw new Error("Unsupported webhook secret format.");
  }
  const packed = Buffer.from(encoded, "base64url");
  const iv = packed.subarray(0, IV_BYTES);
  const tag = packed.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const body = packed.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(keyMaterial), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString(
    "utf-8"
  );
};

/** The key material for this deployment. Throws when none is configured. */
export const webhookKeyMaterial = (
  source: Readonly<Record<string, string | undefined>> = process.env
): string => {
  // An empty assignment in .env means "not configured".
  const dedicated = source["WEBHOOK_ENCRYPTION_KEY"];
  const material = dedicated?.trim() ? dedicated : source["BETTER_AUTH_SECRET"];
  if (!material) {
    throw new Error("No webhook encryption key is configured.");
  }
  return material;
};
