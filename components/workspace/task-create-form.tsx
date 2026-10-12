/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ReactNode } from "react";

import { createTaskAction } from "@/app/actions/tasks";
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
  const router = useRouter();
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
      router.refresh();
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
          <WorkspaceButton className="btn btn-primary btn-sm" type="button">
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
        <label className="field" htmlFor="metsys-task-create-form-field-72">
          <span>Task name</span>
          <WorkspaceInput
            autoComplete="off"
            className="input"
            maxLength={200}
            name="title"
            required
            id="metsys-task-create-form-field-72"
          />
        </label>
        <label className="field" htmlFor="metsys-task-create-form-field-83">
          <span>Description</span>
          <WorkspaceTextarea
            className="input"
            maxLength={10_000}
            name="description"
            rows={3}
            id="metsys-task-create-form-field-83"
          />
        </label>
        <div className="row">
          <label className="field" htmlFor="metsys-task-create-form-field-92">
            <span>Priority</span>
            <WorkspaceSelect
              className="input"
              defaultValue="none"
              name="priority"
              id="metsys-task-create-form-field-92"
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
          <label className="field" htmlFor="metsys-task-create-form-field-108">
            <span>Due date</span>
            <WorkspaceDatePicker
              className="input"
              {...(defaultDueDate === undefined
                ? {}
                : { defaultValue: defaultDueDate })}
              name="dueDate"
              id="metsys-task-create-form-field-108"
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
