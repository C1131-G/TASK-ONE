import type { FieldType } from "@/src/server/custom-fields/custom-field-values";

const LABELS: Readonly<Record<FieldType, string>> = {
  checkbox: "Checkbox",
  date: "Date",
  number: "Number",
  select: "Select",
  text: "Text",
};

export const fieldTypeLabel = (type: FieldType): string => LABELS[type];
