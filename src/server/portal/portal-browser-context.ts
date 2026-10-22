import { Schema } from "effect";

// Markup characters and control characters are refused outright: the context
// is shown as plain text, and unlike a description it has no rich formatting
// to keep, so nothing here is ever stripped and stored half-cleaned.
// oxlint-disable-next-line no-control-regex -- The control range is exactly what is rejected.
const UNSAFE_TEXT = /[<>\u0000-\u001F\u007F]/u;
const BARE_PATH = /^\/[^\s?#<>]*$/u;

const PlainText = (maxLength: number) =>
  Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(maxLength),
    Schema.makeFilter((value) =>
      UNSAFE_TEXT.test(value) ? "Use plain text only." : undefined
    )
  );

const Dimension = Schema.Number.check(
  Schema.isInt(),
  Schema.isBetween({ maximum: 20_000, minimum: 1 })
);

// Non-sensitive facts about the reporter's browser. No cookies, storage,
// query string or console output: the schema has nowhere to put them.
export const BrowserContextSchema = Schema.Struct({
  language: PlainText(35),
  path: PlainText(300).check(
    Schema.makeFilter((value) =>
      BARE_PATH.test(value) ? undefined : "Use a path without a query string."
    )
  ),
  pixelRatio: Schema.Number.check(
    Schema.isFinite(),
    Schema.isBetween({ maximum: 10, minimum: 0.1 })
  ),
  timeZone: PlainText(64),
  userAgent: PlainText(300),
  viewportHeight: Dimension,
  viewportWidth: Dimension,
});

// The activity action a bug's browser context is stored under.
export const CLIENT_CONTEXT_ACTION = "bug.client_context";

export type BrowserContext = typeof BrowserContextSchema.Type;
