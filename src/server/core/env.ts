import "server-only";
import { Schema } from "effect";

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

const MIN_SECRET_LENGTH = 32;
const MAX_TIMEOUT_MILLISECONDS = 3_600_000;

const hasProtocol = (value: string, protocols: readonly string[]): boolean => {
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

// Messages never echo the value: several of these variables are secrets.
const urlString = (protocols: readonly string[], message: string) =>
  Schema.String.check(
    Schema.makeFilter((value) =>
      hasProtocol(value, protocols) ? undefined : message
    )
  );

const secretString = Schema.String.check(Schema.isMinLength(MIN_SECRET_LENGTH));

const integerFromString = (minimum: number, maximum: number) =>
  Schema.FiniteFromString.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(minimum),
    Schema.isLessThanOrEqualTo(maximum)
  );

const timeoutMilliseconds = Schema.optional(
  integerFromString(0, MAX_TIMEOUT_MILLISECONDS)
);

const databaseFields = {
  DATABASE_CONNECTION_TIMEOUT_MS: timeoutMilliseconds,
  DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS: timeoutMilliseconds,
  DATABASE_POOL_MAX: Schema.optional(integerFromString(1, 100)),
  DATABASE_STATEMENT_TIMEOUT_MS: timeoutMilliseconds,
  DATABASE_URL: urlString(
    ["postgres:", "postgresql:"],
    "Expected a postgres:// connection URL"
  ),
};

const httpUrl = urlString(["http:", "https:"], "Expected an http(s) URL");

const MAX_PORT = 65_535;
const MAX_RETENTION_DAYS = 3650;
const retentionDays = Schema.optional(integerFromString(1, MAX_RETENTION_DAYS));

const retentionFields = {
  RETENTION_AUTOMATION_RUN_DAYS: retentionDays,
  RETENTION_COMPLETED_JOB_DAYS: retentionDays,
  RETENTION_DEAD_JOB_DAYS: retentionDays,
  RETENTION_EMAIL_DELIVERY_DAYS: retentionDays,
  RETENTION_PUSH_DELIVERY_DAYS: retentionDays,
  RETENTION_WEBHOOK_DELIVERY_DAYS: retentionDays,
};

const emailFields = {
  EMAIL_FROM: Schema.optional(Schema.String),
  SMTP_HOST: Schema.optional(Schema.String),
  SMTP_PASSWORD: Schema.optional(Schema.String),
  SMTP_PORT: Schema.optional(integerFromString(1, MAX_PORT)),
  SMTP_SECURE: Schema.optional(Schema.Literals(["true", "false"])),
  SMTP_USER: Schema.optional(Schema.String),
};

const serverFields = {
  ...databaseFields,
  ...emailFields,
  ...retentionFields,
  BETTER_AUTH_SECRET: secretString,
  BETTER_AUTH_URL: Schema.optional(httpUrl),
  CI: Schema.optional(Schema.String),
  EXPOSE_TESTING_API: Schema.optional(Schema.String),
  // Shared secret for the inbound email intake endpoint; unset switches it off.
  INTAKE_EMAIL_SECRET: Schema.optional(secretString),
  NODE_ENV: Schema.optional(Schema.String),
  S3_ACCESS_KEY_ID: Schema.optional(Schema.String),
  S3_BUCKET: Schema.optional(Schema.String),
  S3_ENDPOINT: Schema.optional(httpUrl),
  S3_PUBLIC_ENDPOINT: Schema.optional(httpUrl),
  S3_REGION: Schema.optional(Schema.String),
  S3_SECRET_ACCESS_KEY: Schema.optional(Schema.String),
  SCHEDULER_TOKEN: Schema.optional(secretString),
  VAPID_PRIVATE_KEY: Schema.optional(Schema.String),
  VAPID_PUBLIC_KEY: Schema.optional(Schema.String),
  VAPID_SUBJECT: Schema.optional(
    urlString(["mailto:", "https:"], "Expected a mailto: or https: URL")
  ),
  WEBHOOK_ENCRYPTION_KEY: Schema.optional(secretString),
  WEB_PUSH_ALLOWED_HOSTS: Schema.optional(Schema.String),
};

const configuredTogether = (values: readonly (string | undefined)[]) =>
  values.every((value) => value === undefined) ||
  values.every((value) => value !== undefined);

const smtpHostWithSender = Schema.makeFilter(
  (env: {
    readonly SMTP_HOST?: string | undefined;
    readonly EMAIL_FROM?: string | undefined;
  }) =>
    configuredTogether([env.SMTP_HOST, env.EMAIL_FROM])
      ? undefined
      : "SMTP_HOST and EMAIL_FROM must be configured together"
);
const smtpCredentialPair = Schema.makeFilter(
  (env: {
    readonly SMTP_USER?: string | undefined;
    readonly SMTP_PASSWORD?: string | undefined;
  }) =>
    configuredTogether([env.SMTP_USER, env.SMTP_PASSWORD])
      ? undefined
      : "SMTP_USER and SMTP_PASSWORD must be configured together"
);

export const DatabaseEnvSchema = Schema.Struct(databaseFields);
export const RetentionEnvSchema = Schema.Struct(retentionFields);
export const EmailEnvSchema = Schema.Struct(emailFields).check(
  smtpHostWithSender,
  smtpCredentialPair
);

export const ServerEnvSchema = Schema.Struct(serverFields).check(
  Schema.makeFilter((env) =>
    configuredTogether([env.S3_ACCESS_KEY_ID, env.S3_SECRET_ACCESS_KEY])
      ? undefined
      : "S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be configured together"
  ),
  smtpHostWithSender,
  smtpCredentialPair,
  Schema.makeFilter((env) =>
    configuredTogether([
      env.VAPID_PUBLIC_KEY,
      env.VAPID_PRIVATE_KEY,
      env.VAPID_SUBJECT,
    ])
      ? undefined
      : "VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT must be configured together"
  ),
  Schema.makeFilter((env) =>
    env.EXPOSE_TESTING_API === "1" &&
    env.NODE_ENV === "production" &&
    env.CI === undefined
      ? "EXPOSE_TESTING_API=1 is only allowed outside production or in CI"
      : undefined
  )
);

export type DatabaseEnv = typeof DatabaseEnvSchema.Type;
export type ServerEnv = typeof ServerEnvSchema.Type;
export type RetentionEnv = typeof RetentionEnvSchema.Type;
export type EmailEnv = typeof EmailEnvSchema.Type;

// An empty assignment such as `S3_ENDPOINT=` in .env means "not configured".
const withoutBlankValues = (source: EnvironmentSource): EnvironmentSource =>
  Object.fromEntries(
    Object.entries(source).filter(
      ([, value]) => value !== undefined && value.trim() !== ""
    )
  );

const decodeOrThrow = <Decoded>(
  schema: Schema.Decoder<Decoded>,
  source: EnvironmentSource
): Decoded => {
  try {
    return Schema.decodeUnknownSync(schema, { errors: "all" })(
      withoutBlankValues(source)
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid server environment:\n${detail}`, {
      cause: error,
    });
  }
};

/** Validates every server variable; call once at startup to fail fast. */
export const parseServerEnv = (
  source: EnvironmentSource = process.env
): ServerEnv => decodeOrThrow(ServerEnvSchema, source);

/** Validates only the database group for modules that open the pool. */
export const parseDatabaseEnv = (
  source: EnvironmentSource = process.env
): DatabaseEnv => decodeOrThrow(DatabaseEnvSchema, source);

/** Validates the optional data-retention window overrides, in days. */
export const parseRetentionEnv = (
  source: EnvironmentSource = process.env
): RetentionEnv => decodeOrThrow(RetentionEnvSchema, source);

/** Validates only the SMTP group; every field is optional (no SMTP = log only). */
export const parseEmailEnv = (
  source: EnvironmentSource = process.env
): EmailEnv => decodeOrThrow(EmailEnvSchema, source);
