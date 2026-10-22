/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useId, useState, useTransition } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { CustomFieldControl } from "@/features/custom-fields/components/custom-field-control";
import {
  clearCustomFieldValueAction,
  setCustomFieldValueAction,
} from "@/features/custom-fields/custom-field-value-actions";
import type { TaskCustomField } from "@/src/server/custom-fields/custom-field-contracts";
import type { FieldValue } from "@/src/server/custom-fields/custom-field-values";

// One field of the task: its label, the input for its type and the reason an
// edit was refused. A saved edit re-reads the drawer through onChanged.
export const CustomFieldEditor = ({
  canEdit,
  field,
  onChanged,
  taskId,
}: {
  readonly canEdit: boolean;
  readonly field: TaskCustomField;
  readonly onChanged: () => Promise<void>;
  readonly taskId: string;
}) => {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const controlId = useId();
  const errorId = `${controlId}-error`;
  const canClear =
    canEdit && field.value !== null && !field.required && field.type !== "text";

  const save = (value: FieldValue | null) => {
    startTransition(async () => {
      const request = { fieldId: field.id, taskId };
      const result =
        value === null
          ? await clearCustomFieldValueAction({
              ...request,
              idempotencyKey: crypto.randomUUID(),
            })
          : await setCustomFieldValueAction({
              ...request,
              idempotencyKey: crypto.randomUUID(),
              value,
            });
      if (!result.ok) {
        setError(result.error.fieldErrors?.["value"] ?? result.error.message);
        return;
      }
      setError(null);
      await onChanged();
    });
  };

  return (
    <div aria-busy={pending || undefined} className="field">
      <label htmlFor={controlId}>
        {field.name}
        {field.required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <div className="row">
        <CustomFieldControl
          describedBy={error ? errorId : undefined}
          disabled={!canEdit || pending}
          field={field}
          id={controlId}
          invalid={error !== null}
          // The input keeps its draft until the saved value changes.
          key={`${field.id}:${String(field.value)}`}
          onSave={save}
        />
        {canClear ? (
          <WorkspaceButton
            aria-label={`Clear ${field.name}`}
            className="btn"
            disabled={pending}
            onClick={() => save(null)}
            type="button"
          >
            Clear
          </WorkspaceButton>
        ) : null}
      </div>
      {error ? (
        <span className="err" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
};
