import type { FieldType, FieldValue } from "./custom-field-values";

export interface ValueColumns {
  readonly boolValue: boolean | null;
  readonly dateValue: string | null;
  readonly numberValue: number | null;
  readonly textValue: string | null;
}

const NO_VALUE: ValueColumns = {
  boolValue: null,
  dateValue: null,
  numberValue: null,
  textValue: null,
};

// A value lives in the one column that matches its type.
export const columnsFor = (
  type: FieldType,
  value: FieldValue
): ValueColumns => {
  switch (type) {
    case "number": {
      return { ...NO_VALUE, numberValue: Number(value) };
    }
    case "date": {
      return { ...NO_VALUE, dateValue: String(value) };
    }
    case "checkbox": {
      return { ...NO_VALUE, boolValue: value === true };
    }
    case "text":
    case "select": {
      return { ...NO_VALUE, textValue: String(value) };
    }
    default: {
      const unreachable: never = type;
      return unreachable;
    }
  }
};

export const valueFromColumns = (
  type: FieldType,
  columns: ValueColumns
): FieldValue | null => {
  switch (type) {
    case "number": {
      return columns.numberValue;
    }
    case "date": {
      return columns.dateValue;
    }
    case "checkbox": {
      return columns.boolValue;
    }
    case "text":
    case "select": {
      return columns.textValue;
    }
    default: {
      const unreachable: never = type;
      return unreachable;
    }
  }
};
