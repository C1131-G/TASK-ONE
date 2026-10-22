import type { FieldType } from "./custom-field-values";

export const MAX_FIELDS_PER_PROJECT = 20;
export const MAX_FIELD_NAME_LENGTH = 60;
export const MAX_FIELD_OPTIONS = 25;
export const MAX_FIELD_OPTION_LENGTH = 60;

export interface FieldDefinitionInput {
  readonly name: string;
  readonly options: readonly string[];
  readonly type: FieldType;
}

export type ParsedFieldDefinition =
  | {
      readonly ok: true;
      readonly name: string;
      readonly options: readonly string[] | null;
      readonly type: FieldType;
    }
  | {
      readonly ok: false;
      readonly field: "name" | "options";
      readonly message: string;
    };

const isWithinLength = (text: string, maximum: number): boolean =>
  text.length > 0 && text.length <= maximum;

const parseOptions = (
  input: FieldDefinitionInput
): readonly string[] | null | string => {
  if (input.type !== "select") {
    return input.options.length === 0
      ? null
      : "Only a select field has options.";
  }
  const options = input.options.map((option) => option.trim());
  if (options.length === 0 || options.length > MAX_FIELD_OPTIONS) {
    return `Give a select field between 1 and ${MAX_FIELD_OPTIONS} options.`;
  }
  if (
    !options.every((option) => isWithinLength(option, MAX_FIELD_OPTION_LENGTH))
  ) {
    return `Keep each option between 1 and ${MAX_FIELD_OPTION_LENGTH} characters.`;
  }
  const distinct = new Set(options.map((option) => option.toLowerCase()));
  return distinct.size === options.length
    ? options
    : "Each option must be different.";
};

// Checks the part of a field an administrator types: its name and, for a
// select, its list of options.
export const parseFieldDefinition = (
  input: FieldDefinitionInput
): ParsedFieldDefinition => {
  const name = input.name.trim();
  if (!isWithinLength(name, MAX_FIELD_NAME_LENGTH)) {
    return {
      field: "name",
      message: `Enter a field name between 1 and ${MAX_FIELD_NAME_LENGTH} characters.`,
      ok: false,
    };
  }
  const options = parseOptions(input);
  if (typeof options === "string") {
    return { field: "options", message: options, ok: false };
  }
  return { name, ok: true, options, type: input.type };
};
