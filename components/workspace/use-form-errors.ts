"use client";

import { useId, useRef, useState } from "react";

import {
  NO_FORM_ERRORS,
  fieldErrorProps,
  firstErrorField,
  formErrorsFrom,
} from "@/lib/field-errors";
import type { FormErrors } from "@/lib/field-errors";
import type { FieldErrors } from "@/src/server/core/action-result";

interface ActionFailureMessage {
  readonly message: string;
  readonly fieldErrors?: FieldErrors;
}

// Controls are found by the `${formId}-${field}` id the forms give them, so a
// custom picker's visible trigger gets focus rather than its hidden input.
const focusField = (
  form: HTMLFormElement | null,
  formId: string,
  field: string
): void => {
  const byId = form?.querySelector(`#${CSS.escape(`${formId}-${field}`)}`);
  const control = byId ?? form?.elements.namedItem(field);
  if (control instanceof HTMLElement) {
    control.focus();
  }
};

// Inline errors for a workspace form. A failed action's field errors land
// beside the fields the form lists, and focus moves to the first of them;
// anything else shows as the form-level message.
const useFormErrors = (formFields: readonly string[]) => {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<FormErrors>(NO_FORM_ERRORS);

  const showFailure = (failure: ActionFailureMessage): void => {
    const next = formErrorsFrom(failure, formFields);
    setErrors(next);
    const field = firstErrorField(next, formFields);
    if (field) {
      focusField(formRef.current, formId, field);
    }
  };
  const showFormError = (message: string): void =>
    setErrors({ fields: {}, form: message });
  const clearErrors = (): void => setErrors(NO_FORM_ERRORS);
  const fieldProps = (field: string, hintId?: string) =>
    fieldErrorProps(errors, formId, field, hintId);

  return {
    clearErrors,
    errors,
    fieldProps,
    formId,
    formRef,
    showFailure,
    showFormError,
  };
};

export { useFormErrors };
