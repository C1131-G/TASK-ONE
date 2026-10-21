/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useTransition } from "react";

import { useFormErrors } from "@/components/workspace/use-form-errors";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import { WorkspaceDisclosure } from "@/components/workspace/workspace-disclosure";
import {
  WorkspaceFieldError,
  WorkspaceFormError,
} from "@/components/workspace/workspace-field-error";
import { createTeamAction } from "@/features/people/people-actions";

const TEAM_FIELDS = ["name", "color", "description"] as const;

const TeamCreateForm = () => {
  const [pending, startTransition] = useTransition();
  const {
    clearErrors,
    errors,
    fieldProps,
    formId: fieldId,
    formRef,
    showFailure,
  } = useFormErrors(TEAM_FIELDS);
  const create = (formData: FormData, close: () => void) =>
    startTransition(async () => {
      const result = await createTeamAction({
        color: String(formData.get("color")),
        description: String(formData.get("description") ?? "").trim() || null,
        idempotencyKey: crypto.randomUUID(),
        name: String(formData.get("name") ?? "").trim(),
      });
      if (!result.ok) {
        showFailure(result.error);
        return;
      }
      clearErrors();
      close();
    });
  return (
    <WorkspaceDisclosure
      description="Create a team to organize employees."
      title="New team"
      trigger={
        <WorkspaceButton className="btn btn-primary btn-sm" type="button">
          New team
        </WorkspaceButton>
      }
    >
      {(close) => (
        <form
          aria-busy={pending || undefined}
          className="panel-b stack"
          ref={formRef}
          onSubmit={(event) => {
            event.preventDefault();
            create(new FormData(event.currentTarget), close);
          }}
        >
          <div className="row">
            <div className="field grow">
              <label htmlFor={`${fieldId}-name`}>Team name</label>
              <WorkspaceInput
                className="input"
                maxLength={80}
                name="name"
                required
                id={`${fieldId}-name`}
                {...fieldProps("name")}
              />
              <WorkspaceFieldError
                errors={errors}
                field="name"
                formId={fieldId}
              />
            </div>
            <div className="field">
              <label htmlFor={`${fieldId}-color`}>Color</label>
              <WorkspaceInput
                className="input"
                defaultValue="#4b5bd6"
                name="color"
                type="color"
                id={`${fieldId}-color`}
                {...fieldProps("color")}
              />
              <WorkspaceFieldError
                errors={errors}
                field="color"
                formId={fieldId}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor={`${fieldId}-description`}>Description</label>
            <WorkspaceInput
              className="input"
              maxLength={500}
              name="description"
              id={`${fieldId}-description`}
              {...fieldProps("description")}
            />
            <WorkspaceFieldError
              errors={errors}
              field="description"
              formId={fieldId}
            />
          </div>
          <WorkspaceFormError errors={errors} />
          <WorkspaceButton
            aria-busy={pending || undefined}
            className="btn btn-primary"
            disabled={pending}
            type="submit"
          >
            {pending ? "Creating…" : "Create team"}
          </WorkspaceButton>
        </form>
      )}
    </WorkspaceDisclosure>
  );
};

export { TeamCreateForm };
