import type {
  FieldType,
  FieldValue,
} from "@/src/server/custom-fields/custom-field-values";

const NO_VALUE = "—";
const DATE_NOON_SUFFIX = "T12:00:00Z";

const NUMBER_FORMATTER = new Intl.NumberFormat("en", {
  maximumFractionDigits: 6,
});
const DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

const formatDate = (value: string): string => {
  const date = new Date(`${value}${DATE_NOON_SUFFIX}`);
  return Number.isNaN(date.getTime()) ? NO_VALUE : DATE_FORMATTER.format(date);
};

// Read-only text for a table cell. A select stores its chosen option, so the
// option is its label. A value that does not fit its type reads as empty.
export const formatCustomFieldValue = (
  type: FieldType,
  value?: FieldValue | null
): string => {
  if (value === null || value === undefined) {
    return NO_VALUE;
  }
  switch (type) {
    case "text":
    case "select": {
      return typeof value === "string" ? value : NO_VALUE;
    }
    case "number": {
      return typeof value === "number"
        ? NUMBER_FORMATTER.format(value)
        : NO_VALUE;
    }
    case "date": {
      return typeof value === "string" ? formatDate(value) : NO_VALUE;
    }
    case "checkbox": {
      if (typeof value !== "boolean") {
        return NO_VALUE;
      }
      return value ? "Yes" : "No";
    }
    default: {
      const unreachable: never = type;
      return unreachable;
    }
  }
};
