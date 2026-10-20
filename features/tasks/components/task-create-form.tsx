/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useId, useState, useTransition } from "react";
import type { ReactNode } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import {
  WorkspaceInput,
  WorkspaceTextarea,
} from "@/components/workspace/workspace-controls";
import { WorkspaceDatePicker } from "@/components/workspace/workspace-date-picker";
import { WorkspaceModal } from "@/components/workspace/workspace-modal";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";
import { createTaskAction } from "@/features/tasks/tasks-actions";

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
  const fieldId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const isOpen = controlledOpen ?? open;
  const updateOpen = onOpenChange ?? setOpen;

  const createTask = (formData: FormData) => {
    const title = String(formData.get("title") ?? "").trim();
    const dueDate = String(formData.get("dueDate") ?? "");
    const description = String(formData.get("description") ?? "").trim();
    const priority = String(formData.get("priority") ?? "none");
    setError(null);
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
        setError(result.error.message);
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
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          createTask(new FormData(event.currentTarget));
        }}
      >
        <label className="field" htmlFor={`${fieldId}-title`}>
          <span>Task name</span>
          <WorkspaceInput
            autoComplete="off"
            className="input"
            maxLength={200}
            name="title"
            required
            id={`${fieldId}-title`}
          />
        </label>
        <label className="field" htmlFor={`${fieldId}-description`}>
          <span>Description</span>
          <WorkspaceTextarea
            className="input"
            maxLength={10_000}
            name="description"
            rows={3}
            id={`${fieldId}-description`}
          />
        </label>
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
          <label className="field" htmlFor={`${fieldId}-dueDate`}>
            <span>Due date</span>
            <WorkspaceDatePicker
              className="input"
              {...(defaultDueDate === undefined
                ? {}
                : { defaultValue: defaultDueDate })}
              name="dueDate"
              id={`${fieldId}-dueDate`}
            />
          </label>
        </div>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="acts">
          <WorkspaceButton
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
