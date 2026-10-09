import { Schema } from "effect";

const isCalendarDate = (value: string): boolean => {
  const parts = value.split("-");
  if (parts.length !== 3) {
    return false;
  }
  const [yearText, monthText, dayText] = parts;
  if (
    !yearText ||
    !monthText ||
    !dayText ||
    yearText.length !== 4 ||
    monthText.length !== 2 ||
    dayText.length !== 2
  ) {
    return false;
  }
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const isEmailAddress = (value: string): boolean => {
  const parts = value.split("@");
  if (parts.length !== 2) {
    return false;
  }
  const [local, domain] = parts;
  if (!local || !domain || local.startsWith(".") || local.endsWith(".")) {
    return false;
  }
  if ([...value].some((character) => (character.codePointAt(0) ?? 0) <= 32)) {
    return false;
  }
  const labels = domain.split(".");
  return labels.length > 1 && labels.every((label) => label.length > 0);
};

const isHexColor = (value: string): boolean => {
  if (value.length !== 7 || value[0] !== "#") {
    return false;
  }
  for (const character of value.slice(1)) {
    if (!"0123456789abcdef".includes(character.toLowerCase())) {
      return false;
    }
  }
  return true;
};

const isLabelColor = (value: string): boolean =>
  isHexColor(value) ||
  (value.length >= 2 &&
    value.length <= 25 &&
    value[0] !== undefined &&
    "abcdefghijklmnopqrstuvwxyz".includes(value[0]) &&
    [...value].every((character, index) =>
      index === 0
        ? "abcdefghijklmnopqrstuvwxyz".includes(character)
        : "abcdefghijklmnopqrstuvwxyz0123456789-".includes(character)
    ));

const isProjectKey = (value: string): boolean => {
  const [first, ...rest] = value;
  return (
    value.length >= 2 &&
    value.length <= 12 &&
    first !== undefined &&
    first >= "A" &&
    first <= "Z" &&
    rest.every(
      (character) =>
        (character >= "A" && character <= "Z") ||
        (character >= "0" && character <= "9") ||
        character === "_" ||
        character === "-"
    )
  );
};

const isMimeType = (value: string): boolean => {
  const parts = value.split("/");
  if (parts.length !== 2) {
    return false;
  }
  const [type, subtype] = parts;
  const allowed = "abcdefghijklmnopqrstuvwxyz0123456789!#$&^_.+-";
  return Boolean(
    type &&
    subtype &&
    [...type, ...subtype].every((character) =>
      allowed.includes(character.toLowerCase())
    )
  );
};

export const CalendarDateSchema = Schema.String.check(
  Schema.makeFilter((value) =>
    isCalendarDate(value) ? undefined : "Enter a valid calendar date."
  )
);

export const UUIDSchema = Schema.String.check(Schema.isUUID());

export const EmailAddressSchema = Schema.String.check(
  Schema.makeFilter((value) =>
    isEmailAddress(value) ? undefined : "Enter a valid email address."
  )
);

export const HexColorSchema = Schema.String.check(
  Schema.makeFilter((value) =>
    isHexColor(value) ? undefined : "Enter a valid hex color."
  )
);

export const LabelColorSchema = Schema.String.check(
  Schema.makeFilter((value) =>
    isLabelColor(value) ? undefined : "Enter a valid label color."
  )
);

export const ProjectKeySchema = Schema.String.check(
  Schema.makeFilter((value) =>
    isProjectKey(value) ? undefined : "Enter a valid project key."
  )
);

export const MimeTypeSchema = Schema.String.check(
  Schema.makeFilter((value) =>
    isMimeType(value) ? undefined : "Enter a valid media type."
  )
);

export const IdempotencyKeySchema = Schema.String.check(
  Schema.isMinLength(8),
  Schema.isMaxLength(128)
);
