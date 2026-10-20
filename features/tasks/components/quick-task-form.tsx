/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { Plus } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ReactNode } from "react";

import { useFormErrors } from "@/components/workspace/use-form-errors";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceCombobox } from "@/components/workspace/workspace-combobox";
import {
  WorkspaceInput,
  WorkspaceTextarea,
} from "@/components/workspace/workspace-controls";
import { WorkspaceDatePicker } from "@/components/workspace/workspace-date-picker";
import {
  WorkspaceFieldError,
  WorkspaceFormError,
} from "@/components/workspace/workspace-field-error";
import { WorkspaceModal } from "@/components/workspace/workspace-modal";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";
import { createTaskAction } from "@/features/tasks/tasks-actions";

interface ProjectOption {
  readonly id: string;
  readonly name: string;
}

const EMPTY_ASSIGNEE_IDS: readonly string[] = [];
const QUICK_TASK_FIELDS = [
  "title",
  "projectId",
  "description",
  "priority",
  "dueDate",
] as const;

export const QuickTaskForm = ({
  onOpenChange,
  open: controlledOpen,
  projects,
  defaultDueDate,
  defaultAssigneeIds = EMPTY_ASSIGNEE_IDS,
  description: modalDescription,
  trigger,
}: {
  readonly onOpenChange?: (open: boolean) => void;
  readonly open?: boolean;
  readonly defaultDueDate?: string;
  readonly defaultAssigneeIds?: readonly string[];
  readonly description?: string;
  readonly projects: readonly ProjectOption[];
  readonly trigger?: ReactNode | null;
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
  } = useFormErrors(QUICK_TASK_FIELDS);
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = onOpenChange ?? setLocalOpen;

  const create = (formData: FormData) =>
    startTransition(async () => {
      const result = await createTaskAction({
        assigneeIds: [...defaultAssigneeIds],
        description: String(formData.get("description") ?? "").trim() || null,
        dueDate: String(formData.get("dueDate") ?? "") || null,
        idempotencyKey: crypto.randomUUID(),
        priority: String(formData.get("priority") ?? "none"),
        projectId: String(formData.get("projectId") ?? ""),
        title: String(formData.get("title") ?? "").trim(),
      });
      if (!result.ok) {
        showFailure(result.error);
        return;
      }
      clearErrors();
      setOpen(false);
      router.push(`/projects/${result.data.projectId}?view=board`);
    });

  return (
    <WorkspaceModal
      description={
        modalDescription ?? "Add a task to a project and choose when it is due."
      }
      onOpenChange={setOpen}
      open={open}
      title="New task"
      trigger={
        trigger === undefined ? (
          <WorkspaceButton className="btn btn-primary btn-sm" type="button">
            <Plus aria-hidden="true" size={14} />
            New task
          </WorkspaceButton>
        ) : (
          trigger
        )
      }
    >
      <form
        action={create}
        aria-busy={pending || undefined}
        className="stack"
        ref={formRef}
      >
        <div className="field">
          <label htmlFor={`${fieldId}-title`}>Task name</label>
          <WorkspaceInput
            autoComplete="off"
            className="input"
            maxLength={200}
            name="title"
            required
            id={`${fieldId}-title`}
            {...fieldProps("title")}
          />
          <WorkspaceFieldError errors={errors} field="title" formId={fieldId} />
        </div>
        <div className="field">
          <label htmlFor={`${fieldId}-projectId`}>Project</label>
          <WorkspaceCombobox
            ariaLabel="Choose a project"
            className="input"
            defaultValue={projects[0]?.id ?? ""}
            disabled={projects.length === 0}
            emptyMessage="No projects found."
            id={`${fieldId}-projectId`}
            name="projectId"
            options={projects.map((project) => ({
              label: project.name,
              value: project.id,
            }))}
            placeholder="Choose project"
            searchPlaceholder="Search projects"
          />
          <WorkspaceFieldError
            errors={errors}
            field="projectId"
            formId={fieldId}
          />
        </div>
        <div className="field">
          <label htmlFor={`${fieldId}-description`}>Description</label>
          <WorkspaceTextarea
            className="input"
            maxLength={10_000}
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
        <div className="row">
          <label className="field" htmlFor={`${fieldId}-priority`}>
            <span>Priority</span>
            <WorkspaceSelect
              className="input"
              defaultValue="none"
              name="priority"
              id={`${fieldId}-priority`}
            >
              <WorkspaceSelectItem value="urgent">Urgent</WorkspaceSelectItem>
              <WorkspaceSelectItem value="high">High</WorkspaceSelectItem>
              <WorkspaceSelectItem value="medium">Medium</WorkspaceSelectItem>
              <WorkspaceSelectItem value="low">Low</WorkspaceSelectItem>
              <WorkspaceSelectItem value="none">
                No priority
              </WorkspaceSelectItem>
            </WorkspaceSelect>
          </label>
          <div className="field">
            <label htmlFor={`${fieldId}-dueDate`}>Due date</label>
            <WorkspaceDatePicker
              className="input"
              {...(defaultDueDate === undefined
                ? {}
                : { defaultValue: defaultDueDate })}
              name="dueDate"
              id={`${fieldId}-dueDate`}
              {...fieldProps("dueDate")}
            />
            <WorkspaceFieldError
              errors={errors}
              field="dueDate"
              formId={fieldId}
            />
          </div>
        </div>
        <WorkspaceFormError errors={errors} />
        <WorkspaceButton
          aria-busy={pending || undefined}
          className="btn btn-primary"
          disabled={pending}
          type="submit"
        >
          {pending ? "Creating…" : "Create task"}
        </WorkspaceButton>
      </form>
    </WorkspaceModal>
  );
};
