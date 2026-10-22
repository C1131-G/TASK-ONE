/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useState, useTransition } from "react";

import { useFormErrors } from "@/components/workspace/use-form-errors";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import {
  WorkspaceInput,
  WorkspaceTextarea,
} from "@/components/workspace/workspace-controls";
import {
  WorkspaceFieldError,
  WorkspaceFormError,
} from "@/components/workspace/workspace-field-error";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";
import {
  createCustomFieldAction,
  updateCustomFieldAction,
} from "@/features/custom-fields/custom-field-actions";
import { fieldTypeLabel } from "@/features/custom-fields/custom-field-labels";
import type { CustomFieldView } from "@/src/server/custom-fields/custom-field-contracts";
import {
  MAX_FIELD_NAME_LENGTH,
  MAX_FIELD_OPTIONS,
} from "@/src/server/custom-fields/custom-field-definition";
import { FieldTypeSchema } from "@/src/server/custom-fields/custom-field-values";
import type { FieldType } from "@/src/server/custom-fields/custom-field-values";

const FIELDS = ["name", "options"] as const;
const TYPES = FieldTypeSchema.literals;

const toOptionLines = (text: string): string[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

// Creates a field on a project, or edits an existing one. The type is chosen
// once: it is shown but cannot change afterwards.
export const CustomFieldForm = ({
  existing,
  onDone,
  projectId,
}: {
  readonly existing?: CustomFieldView;
  readonly onDone: () => void;
  readonly projectId: string;
}) => {
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<FieldType>(existing?.type ?? "text");
  const { clearErrors, errors, fieldProps, formId, formRef, showFailure } =
    useFormErrors(FIELDS);

  const submit = (form: HTMLFormElement) => {
    const data = new FormData(form);
    const draft = {
      idempotencyKey: crypto.randomUUID(),
      name: String(data.get("name") ?? ""),
      options:
        type === "select"
          ? toOptionLines(String(data.get("options") ?? ""))
          : [],
      required: data.get("required") === "on",
    };
    startTransition(async () => {
      const result = existing
        ? await updateCustomFieldAction({ ...draft, fieldId: existing.id })
        : await createCustomFieldAction({ ...draft, projectId, type });
      if (!result.ok) {
        showFailure(result.error);
        return;
      }
      clearErrors();
      form.reset();
      onDone();
    });
  };

  return (
    <form
      aria-busy={pending || undefined}
      className="stack"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit(event.currentTarget);
      }}
      ref={formRef}
    >
      <div className="field">
        <label htmlFor={`${formId}-name`}>Name</label>
        <WorkspaceInput
          defaultValue={existing?.name ?? ""}
          id={`${formId}-name`}
          maxLength={MAX_FIELD_NAME_LENGTH}
          name="name"
          required
          {...fieldProps("name")}
        />
        <WorkspaceFieldError errors={errors} field="name" formId={formId} />
      </div>
      <div className="field">
        <label htmlFor={`${formId}-type`}>Type</label>
        <WorkspaceSelect
          disabled={existing !== undefined}
          displayValue={fieldTypeLabel(type)}
          id={`${formId}-type`}
          onValueChange={(next) => {
            const chosen = TYPES.find((candidate) => candidate === next);
            if (chosen) {
              setType(chosen);
            }
          }}
          value={type}
        >
          {TYPES.map((candidate) => (
            <WorkspaceSelectItem key={candidate} value={candidate}>
              {fieldTypeLabel(candidate)}
            </WorkspaceSelectItem>
          ))}
        </WorkspaceSelect>
      </div>
      {type === "select" ? (
        <div className="field">
          <label htmlFor={`${formId}-options`}>
            Options, one per line (up to {MAX_FIELD_OPTIONS})
          </label>
          <WorkspaceTextarea
            className="input"
            defaultValue={existing?.options.join("\n") ?? ""}
            id={`${formId}-options`}
            name="options"
            rows={4}
            {...fieldProps("options")}
          />
          <WorkspaceFieldError
            errors={errors}
            field="options"
            formId={formId}
          />
        </div>
      ) : null}
      <label className="row">
        <input
          defaultChecked={existing?.required ?? false}
          name="required"
          type="checkbox"
        />
        <span>Required once a value is set</span>
      </label>
      <WorkspaceFormError errors={errors} />
      <div className="row">
        <WorkspaceButton
          aria-busy={pending || undefined}
          className="btn btn-primary"
          disabled={pending}
          type="submit"
        >
          {existing ? "Save field" : "Add field"}
        </WorkspaceButton>
        {existing ? (
          <WorkspaceButton className="btn" onClick={onDone} type="button">
            Cancel
          </WorkspaceButton>
        ) : null}
      </div>
    </form>
  );
};
