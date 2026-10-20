/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useRouter } from "next/navigation";
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
import { WorkspaceModal } from "@/components/workspace/workspace-modal";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";
import { createProjectAction } from "@/features/projects/projects-actions";

const templates = [
  ["blank", "Blank project"],
  ["product", "Product launch"],
  ["web", "Website project"],
  ["mkt", "Marketing campaign"],
  ["design", "Design project"],
  ["software", "Software project"],
  ["personal", "Personal project"],
] as const;

const PROJECT_FIELDS = ["name", "key", "description", "templateId"] as const;

const ProjectCreateForm = ({
  triggerLabel = "New project",
}: {
  // Empty states reuse the form with their own call to action.
  readonly triggerLabel?: string;
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const {
    clearErrors,
    errors,
    fieldProps,
    formId: fieldId,
    formRef,
    showFailure,
  } = useFormErrors(PROJECT_FIELDS);
  const [open, setOpen] = useState(false);

  const createProject = (formData: FormData) => {
    const name = String(formData.get("name") ?? "").trim();
    const key = String(formData.get("key") ?? "")
      .trim()
      .toUpperCase();
    const description = String(formData.get("description") ?? "").trim();
    const templateId = String(formData.get("templateId") ?? "blank");
    clearErrors();
    startTransition(async () => {
      const result = await createProjectAction({
        description: description || null,
        idempotencyKey: crypto.randomUUID(),
        key,
        name,
        status: "planning",
        templateId,
      });
      if (!result.ok) {
        showFailure(result.error);
        return;
      }
      setOpen(false);
      router.push(`/projects/${result.data.id}`, {
        transitionTypes: ["nav-forward"],
      });
    });
  };

  return (
    <WorkspaceModal
      description="Create a project workspace and choose a starter template."
      onOpenChange={setOpen}
      open={open}
      title="New project"
      trigger={
        <WorkspaceButton className="btn btn-primary" type="button">
          {triggerLabel}
        </WorkspaceButton>
      }
    >
      <form
        aria-busy={pending || undefined}
        className="stack"
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          createProject(new FormData(event.currentTarget));
        }}
      >
        <div className="row">
          <div className="field grow">
            <label htmlFor={`${fieldId}-name`}>Project name</label>
            <WorkspaceInput
              autoComplete="off"
              className="input"
              maxLength={120}
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
            <label htmlFor={`${fieldId}-key`}>Project key</label>
            <WorkspaceInput
              autoComplete="off"
              className="input mono"
              maxLength={12}
              name="key"
              required
              id={`${fieldId}-key`}
              {...fieldProps("key")}
            />
            <WorkspaceFieldError errors={errors} field="key" formId={fieldId} />
          </div>
        </div>
        <div className="field">
          <label htmlFor={`${fieldId}-description`}>Description</label>
          <WorkspaceTextarea
            className="input"
            maxLength={1000}
            name="description"
            rows={2}
            id={`${fieldId}-description`}
            {...fieldProps("description")}
          />
          <WorkspaceFieldError
            errors={errors}
            field="description"
            formId={fieldId}
          />
        </div>
        <label className="field" htmlFor={`${fieldId}-templateId`}>
          <span>Template</span>
          <WorkspaceSelect
            className="input"
            defaultValue="blank"
            name="templateId"
            id={`${fieldId}-templateId`}
          >
            {templates.map(([id, label]) => (
              <WorkspaceSelectItem key={id} value={id}>
                {label}
              </WorkspaceSelectItem>
            ))}
          </WorkspaceSelect>
        </label>
        <WorkspaceFormError errors={errors} />
        <div className="acts">
          <WorkspaceButton
            aria-busy={pending || undefined}
            className="btn btn-primary"
            disabled={pending}
            size="sm"
            type="submit"
            variant="default"
          >
            {pending ? "Creating…" : "Create project"}
          </WorkspaceButton>
        </div>
      </form>
    </WorkspaceModal>
  );
};

export { ProjectCreateForm };
