/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { Plus } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ReactNode } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceCombobox } from "@/components/workspace/workspace-combobox";
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

interface ProjectOption {
  readonly id: string;
  readonly name: string;
}

const EMPTY_ASSIGNEE_IDS: readonly string[] = [];

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
  const [error, setError] = useState<string | null>(null);
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
        setError(result.error.message);
        return;
      }
      setError(null);
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
      <form action={create} className="stack">
        <label className="field" htmlFor="metsys-quick-task-form-field-71">
          <span>Task name</span>
          <WorkspaceInput
            autoComplete="off"
            className="input"
            maxLength={200}
            name="title"
            required
            id="metsys-quick-task-form-field-71"
          />
        </label>
        <label className="field" htmlFor="metsys-quick-task-form-field-81">
          <span>Project</span>
          <WorkspaceCombobox
            ariaLabel="Choose a project"
            className="input"
            defaultValue={projects[0]?.id ?? ""}
            disabled={projects.length === 0}
            emptyMessage="No projects found."
            id="metsys-quick-task-form-field-81"
            name="projectId"
            options={projects.map((project) => ({
              label: project.name,
              value: project.id,
            }))}
            placeholder="Choose project"
            searchPlaceholder="Search projects"
          />
        </label>
        <label className="field" htmlFor="metsys-quick-task-form-field-99">
          <span>Description</span>
          <WorkspaceTextarea
            className="input"
            maxLength={10_000}
            name="description"
            rows={2}
            id="metsys-quick-task-form-field-99"
          />
        </label>
        <div className="row">
          <label className="field" htmlFor="metsys-quick-task-form-field-107">
            <span>Priority</span>
            <WorkspaceSelect
              className="input"
              defaultValue="none"
              name="priority"
              id="metsys-quick-task-form-field-107"
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
          <label className="field" htmlFor="metsys-quick-task-form-field-123">
            <span>Due date</span>
            <WorkspaceDatePicker
              className="input"
              {...(defaultDueDate === undefined
                ? {}
                : { defaultValue: defaultDueDate })}
              name="dueDate"
              id="metsys-quick-task-form-field-123"
            />
          </label>
        </div>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <WorkspaceButton
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
