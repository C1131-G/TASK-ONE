/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in app/workspace-styles. */

import { fieldErrorId } from "@/lib/field-errors";
import type { FormErrors } from "@/lib/field-errors";

// The message under one field; its id is what the field's aria-describedby names.
const WorkspaceFieldError = ({
  errors,
  field,
  formId,
}: {
  readonly errors: FormErrors;
  readonly field: string;
  readonly formId: string;
}) => {
  const message = errors.fields[field];
  return message ? (
    <span className="err" id={fieldErrorId(formId, field)} role="alert">
      {message}
    </span>
  ) : null;
};

// A failure no field on the form owns, such as a permission or network error.
const WorkspaceFormError = ({ errors }: { readonly errors: FormErrors }) =>
  errors.form ? (
    <p className="error" role="alert">
      {errors.form}
    </p>
  ) : null;

export { WorkspaceFieldError, WorkspaceFormError };
