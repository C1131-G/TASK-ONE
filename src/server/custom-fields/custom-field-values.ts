import { Schema } from "effect";

import { CalendarDateSchema } from "../core/input-schemas";

export const MAX_FIELD_VALUE_LENGTH = 500;

export const FieldTypeSchema = Schema.Literals([
  "text",
  "number",
  "select",
  "date",
  "checkbox",
]);
export type FieldType = typeof FieldTypeSchema.Type;

export interface FieldShape {
  readonly options: readonly string[] | null;
  readonly type: FieldType;
}

export type FieldValue = string | number | boolean;

export type ParsedFieldValue =
  | { readonly ok: true; readonly value: FieldValue }
  | { readonly ok: false; readonly message: string };

const TextValueSchema = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(MAX_FIELD_VALUE_LENGTH)
);
const isTextValue = Schema.is(TextValueSchema);

// Doubles are exact for whole numbers up to 2^53; the cap keeps a stored
// number round-tripping through JSON and a spreadsheet.
export const MAX_FIELD_NUMBER = 1e15;
const NumberValueSchema = Schema.Number.check(
  Schema.isFinite(),
  Schema.isBetween({
    maximum: MAX_FIELD_NUMBER,
    minimum: -MAX_FIELD_NUMBER,
  })
);
const isNumberValue = Schema.is(NumberValueSchema);
const isDateValue = Schema.is(CalendarDateSchema);
const isCheckboxValue = Schema.is(Schema.Boolean);

const accept = (value: FieldValue): ParsedFieldValue => ({ ok: true, value });
const reject = (message: string): ParsedFieldValue => ({ message, ok: false });

// Checks one incoming value against the field's type. Text is trimmed first,
// so a value of only spaces counts as empty.
export const parseFieldValue = (
  field: FieldShape,
  raw: unknown
): ParsedFieldValue => {
  const candidate = typeof raw === "string" ? raw.trim() : raw;
  switch (field.type) {
    case "text": {
      return isTextValue(candidate)
        ? accept(candidate)
        : reject(
            `Enter between 1 and ${MAX_FIELD_VALUE_LENGTH} characters of text.`
          );
    }
    case "number": {
      return isNumberValue(raw) ? accept(raw) : reject("Enter a number.");
    }
    case "select": {
      return typeof candidate === "string" && field.options?.includes(candidate)
        ? accept(candidate)
        : reject("Choose one of the listed options.");
    }
    case "date": {
      return isDateValue(candidate)
        ? accept(candidate)
        : reject("Enter a real date written as YYYY-MM-DD.");
    }
    case "checkbox": {
      return isCheckboxValue(raw) ? accept(raw) : reject("Choose yes or no.");
    }
    default: {
      const unreachable: never = field.type;
      return unreachable;
    }
  }
};
