import { createHmac } from "node:crypto";

import { hashSender, issueFormToken } from "./intake-guard";

// The placeholder account every external report is attributed to. It has no
// credentials and is banned, so nobody can ever sign in as it.
export const externalReporterId = "5e6f7a8b-0000-4000-8000-000000000001";
export const EXTERNAL_REPORTER_NAME = "External reporter";
export const EXTERNAL_REPORTER_EMAIL = "external-reporter@intake.invalid";

export const MAX_TITLE_LENGTH = 150;
export const MAX_DESCRIPTION_LENGTH = 5000;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_MESSAGE_ID_LENGTH = 512;
export const MAX_NAME_LENGTH = 120;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
// A web submission may not exceed this many requests per sender and hour.
export const WEB_RATE_LIMIT = 5;
export const WEB_RATE_WINDOW_MS = 60 * 60 * 1000;
export const UNKNOWN_SENDER = "unknown";

// Keys are derived from the auth secret so no new variable is needed for the
// form token and sender hashes; the inbound email secret is separate because
// the mail gateway has to hold it.
const derivedSecret = (purpose: string): string => {
  const base = process.env["BETTER_AUTH_SECRET"];
  if (!base) {
    throw new Error("BETTER_AUTH_SECRET must be configured.");
  }
  return createHmac("sha256", base).update(`intake.${purpose}`).digest("hex");
};

export const issueFormTokenFor = (slug: string, nowMs: number): string =>
  issueFormToken(derivedSecret("form"), slug, nowMs);

export const formTokenSecret = (): string => derivedSecret("form");

export const hashSenderAddress = (value: string): string =>
  hashSender(derivedSecret("sender"), value);

// The shared secret for the inbound email endpoint, or undefined when email
// intake is switched off.
export const inboundEmailSecret = (): string | undefined => {
  const secret = process.env["INTAKE_EMAIL_SECRET"]?.trim();
  return secret || undefined;
};
