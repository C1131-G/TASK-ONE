import type {
  Errors,
  FieldKey,
  Values,
} from "@/features/portal/components/portal-bug-form-model";

export type Patch = (patch: Partial<Values>) => void;

export const errorId = (key: FieldKey) => `portal-err-${key}`;

export const describedBy = (errors: Errors, key: FieldKey, hintId?: string) =>
  [hintId, errors[key] ? errorId(key) : undefined].filter(Boolean).join(" ") ||
  undefined;
