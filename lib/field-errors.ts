import type { FieldErrors } from "@/src/server/core/action-result";

// What a form shows after a failed action: messages beside the fields it
// renders, and a form-level message for anything no field on screen owns.
interface FormErrors {
  readonly fields: FieldErrors;
  readonly form: string | undefined;
}

interface ActionFailureMessage {
  readonly message: string;
  readonly fieldErrors?: FieldErrors;
}

const NO_FORM_ERRORS: FormErrors = { fields: {}, form: undefined };

const formErrorsFrom = (
  failure: ActionFailureMessage,
  formFields: readonly string[]
): FormErrors => {
  const fields: Record<string, string> = {};
  for (const field of formFields) {
    const message = failure.fieldErrors?.[field];
    if (message) {
      fields[field] = message;
    }
  }
  const hasFieldError = Object.keys(fields).length > 0;
  return { fields, form: hasFieldError ? undefined : failure.message };
};

const fieldErrorId = (formId: string, field: string): string =>
  `${formId}-${field}-error`;

// aria-invalid plus aria-describedby joining an optional hint and the error.
const fieldErrorProps = (
  errors: FormErrors,
  formId: string,
  field: string,
  hintId?: string
) => {
  const invalid = Boolean(errors.fields[field]);
  const describedBy = [hintId, invalid ? fieldErrorId(formId, field) : ""]
    .filter(Boolean)
    .join(" ");
  return {
    "aria-describedby": describedBy || undefined,
    "aria-invalid": invalid ? true : undefined,
  } as const;
};

const firstErrorField = (
  errors: FormErrors,
  formFields: readonly string[]
): string | undefined => formFields.find((field) => errors.fields[field]);

export {
  NO_FORM_ERRORS,
  fieldErrorId,
  fieldErrorProps,
  firstErrorField,
  formErrorsFrom,
};
export type { FormErrors };
