import { AppError } from "../core/action-result";
import { sanitizeDescription } from "../work/sanitize-description";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_EMAIL_LENGTH,
  MAX_TITLE_LENGTH,
} from "./intake-config";

// Everything a stranger types is treated as plain text: markup characters are
// removed from titles and escaped in descriptions, then the shared description
// sanitizer runs over the result as a second line of defence.

// Bug descriptions are capped at 10,000 characters once escaped.
const MAX_STORED_HTML_LENGTH = 9500;
const SHRINK_RATIO = 0.8;
const TAB = 9;
const LINE_FEED = 10;
const FIRST_PRINTABLE = 32;
const DELETE = 127;
const LINE_BREAKS = /\r\n?/gu;
const PARAGRAPH_BREAK = /\n{2,}/u;
const WHITESPACE_RUN = /\s+/gu;
const MARKUP_CHARACTERS = /[<>]/gu;
const ADDRESS_PATTERN =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/u;

// Control characters other than tab and newline are never legitimate text.
const replaceControlCharacters = (raw: string, replacement: string): string =>
  [...raw]
    .map((character) => {
      const code = character.codePointAt(0) ?? FIRST_PRINTABLE;
      const isControl =
        (code < FIRST_PRINTABLE && code !== TAB && code !== LINE_FEED) ||
        code === DELETE;
      return isControl ? replacement : character;
    })
    .join("");

export const fieldFailure = (field: string, message: string): AppError =>
  new AppError({
    code: "VALIDATION_FAILED",
    fieldErrors: { [field]: message },
    message,
  });

export const cleanTitle = (raw: string): string =>
  replaceControlCharacters(raw, " ")
    .replaceAll(MARKUP_CHARACTERS, "")
    .replaceAll(WHITESPACE_RUN, " ")
    .trim();

const cleanText = (raw: string): string =>
  replaceControlCharacters(raw.replaceAll(LINE_BREAKS, "\n"), "").trim();

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const paragraphs = (text: string): string =>
  text
    .split(PARAGRAPH_BREAK)
    .map((block) => `<p>${escapeHtml(block).replaceAll("\n", "<br>")}</p>`)
    .join("");

// The bug description: who reported it and how, then their words as text.
export const buildDescription = (
  text: string,
  reporter: { readonly email: string; readonly via: string }
): string => {
  const header = `<p><strong>Reporter:</strong> ${escapeHtml(reporter.email)} (${escapeHtml(reporter.via)})</p>`;
  let body = cleanText(text);
  let html = `${header}${paragraphs(body)}`;
  while (html.length > MAX_STORED_HTML_LENGTH && body.length > 1) {
    body = body.slice(0, Math.floor(body.length * SHRINK_RATIO));
    html = `${header}${paragraphs(body)}`;
  }
  return sanitizeDescription(html) ?? header;
};

export const parseEmailAddress = (raw: string): string | null => {
  const trimmed = raw.trim();
  // "Name <address>" keeps only what sits between the last pair of brackets.
  const open = trimmed.lastIndexOf("<");
  const candidate =
    trimmed.endsWith(">") && open !== -1
      ? trimmed.slice(open + 1, -1).trim()
      : trimmed;
  return candidate.length <= MAX_EMAIL_LENGTH && ADDRESS_PATTERN.test(candidate)
    ? candidate.toLowerCase()
    : null;
};

export interface WebFields {
  readonly description: string;
  readonly email: string;
  readonly title: string;
}

// Web submissions are refused when a field is out of bounds, naming every
// field at fault so the form can point at it.
export const validateWebFields = (raw: {
  readonly description: string;
  readonly email: string;
  readonly title: string;
}): WebFields => {
  const title = cleanTitle(raw.title);
  const description = cleanText(raw.description);
  const email = parseEmailAddress(raw.email);
  const fieldErrors: Record<string, string> = {};
  if (!title || title.length > MAX_TITLE_LENGTH) {
    fieldErrors["title"] =
      `Enter a title of up to ${MAX_TITLE_LENGTH} characters.`;
  }
  if (!description || description.length > MAX_DESCRIPTION_LENGTH) {
    fieldErrors["description"] =
      `Describe the problem in up to ${MAX_DESCRIPTION_LENGTH.toLocaleString("en-US")} characters.`;
  }
  if (!email || raw.email.trim().length > MAX_EMAIL_LENGTH) {
    fieldErrors["email"] = "Enter a valid email address.";
  }
  if (Object.keys(fieldErrors).length > 0 || !email) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      fieldErrors,
      message: Object.values(fieldErrors)[0] ?? "Check the form.",
    });
  }
  return { description, email, title };
};
