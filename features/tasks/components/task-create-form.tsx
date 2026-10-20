/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";

import { useFormErrors } from "@/components/workspace/use-form-errors";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
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

const TASK_FIELDS = ["title", "description", "priority", "dueDate"] as const;

const TaskCreateForm = ({
  projectId,
  defaultDueDate,
  open: controlledOpen,
  onOpenChange,
  trigger,
}: {
  readonly projectId: string;
  readonly defaultDueDate?: string;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly trigger?: ReactNode | null;
}) => {
  const [pending, startTransition] = useTransition();
  const {
    clearErrors,
    errors,
    fieldProps,
    formId: fieldId,
    formRef,
    showFailure,
  } = useFormErrors(TASK_FIELDS);
  const [open, setOpen] = useState(false);
  const isOpen = controlledOpen ?? open;
  const updateOpen = onOpenChange ?? setOpen;

  const createTask = (formData: FormData) => {
    const title = String(formData.get("title") ?? "").trim();
    const dueDate = String(formData.get("dueDate") ?? "");
    const description = String(formData.get("description") ?? "").trim();
    const priority = String(formData.get("priority") ?? "none");
    clearErrors();
    startTransition(async () => {
      const result = await createTaskAction({
        assigneeIds: [],
        description: description || null,
        dueDate: dueDate || null,
        idempotencyKey: crypto.randomUUID(),
        priority,
        projectId,
        title,
      });
      if (!result.ok) {
        showFailure(result.error);
        return;
      }
      updateOpen(false);
    });
  };

  return (
    <WorkspaceModal
      description="Add a task to this project and set its priority and due date."
      onOpenChange={updateOpen}
      open={isOpen}
      title="New task"
      trigger={
        trigger === undefined ? (
          <WorkspaceButton
            className="btn btn-primary btn-sm w-fit"
            type="button"
          >
            New task
          </WorkspaceButton>
        ) : (
          trigger
        )
      }
    >
      <form
        aria-busy={pending || undefined}
        className="stack"
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          createTask(new FormData(event.currentTarget));
        }}
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
          <label htmlFor={`${fieldId}-description`}>Description</label>
          <WorkspaceTextarea
            className="input"
            maxLength={10_000}
            name="description"
            rows={3}
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
        <div className="acts">
          <WorkspaceButton
            aria-busy={pending || undefined}
            className="btn btn-primary"
            disabled={pending}
            type="submit"
          >
            {pending ? "Creating…" : "Create task"}
          </WorkspaceButton>
        </div>
      </form>
    </WorkspaceModal>
  );
};

export { TaskCreateForm };
