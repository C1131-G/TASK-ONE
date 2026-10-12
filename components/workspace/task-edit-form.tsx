/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateTaskAction } from "@/app/actions/tasks";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { TaskRecurrenceInput } from "@/src/server/work/work-contracts";

export interface EditableTask {
  readonly id: string;
  readonly projectId: string;
  readonly createdById: string;
  readonly version: number;
  readonly title: string;
  readonly description: string | null;
  readonly status: "backlog" | "todo" | "progress" | "review" | "done";
  readonly priority: "urgent" | "high" | "medium" | "low" | "none";
  readonly dueDate: string | null;
  readonly startDate: string | null;
  readonly estimate: string | null;
  readonly assigneeIds: readonly string[];
  readonly labelIds: readonly string[];
  readonly dependencyIds: readonly string[];
  readonly recurrence: TaskRecurrenceInput | null;
}

interface EmployeeOption {
  readonly id: string;
  readonly name: string;
}

export const TaskEditForm = ({
  task,
  employees,
  version,
  open,
  onOpenChange,
  onVersionChange,
  onCompletionUndo,
}: {
  readonly task: EditableTask;
  readonly employees: readonly EmployeeOption[];
  readonly version: number;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onVersionChange: (version: number) => void;
  readonly onCompletionUndo: (
    undo: { readonly undoId: string; readonly expiresAt: string } | null
  ) => void;
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const selectedAssigneeIds = new Set(task.assigneeIds);

  const update = (formData: FormData) =>
    startTransition(async () => {
      const result = await updateTaskAction({
        assigneeIds: formData.getAll("assigneeIds").map(String),
        description: String(formData.get("description") ?? "").trim() || null,
        dueDate: String(formData.get("dueDate") ?? "") || null,
        expectedVersion: version,
        idempotencyKey: crypto.randomUUID(),
        priority: String(formData.get("priority") ?? task.priority),
        startDate: String(formData.get("startDate") ?? "") || null,
        status: String(formData.get("status") ?? task.status),
        taskId: task.id,
        title: String(formData.get("title") ?? "").trim(),
        ...(String(formData.get("estimate") ?? "")
          ? { estimate: String(formData.get("estimate")) }
          : { estimate: null }),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onVersionChange(result.data.version);
      onCompletionUndo(result.data.completionUndo ?? null);
      setError(null);
      onOpenChange(false);
      router.refresh();
    });

  return (
    <WorkspaceModal
      description="Update task details and save the changes to this task."
      onOpenChange={onOpenChange}
      open={open}
      title={`Edit ${task.title}`}
      trigger={null}
    >
      <form
        className="panel-b stack"
        onSubmit={(event) => {
          event.preventDefault();
          update(new FormData(event.currentTarget));
        }}
      >
        <label className="field" htmlFor={`task-${task.id}-field-119`}>
          <span>Title</span>
          <WorkspaceInput
            className="input"
            defaultValue={task.title}
            maxLength={200}
            name="title"
            required
            id={`task-${task.id}-field-119`}
          />
        </label>
        <label className="field" htmlFor={`task-${task.id}-field-130`}>
          <span>Description</span>
          <WorkspaceTextarea
            className="input"
            defaultValue={task.description ?? ""}
            maxLength={10_000}
            name="description"
            rows={3}
            id={`task-${task.id}-field-130`}
          />
        </label>
        <div className="row">
          <label className="field" htmlFor={`task-${task.id}-field-140`}>
            <span>Status</span>
            <WorkspaceSelect
              className="input"
              defaultValue={task.status}
              name="status"
              id={`task-${task.id}-field-140`}
            >
              <WorkspaceSelectItem value="backlog">Backlog</WorkspaceSelectItem>
              <WorkspaceSelectItem value="todo">To Do</WorkspaceSelectItem>
              <WorkspaceSelectItem value="progress">
                In Progress
              </WorkspaceSelectItem>
              <WorkspaceSelectItem value="review">Review</WorkspaceSelectItem>
              <WorkspaceSelectItem value="done">Done</WorkspaceSelectItem>
            </WorkspaceSelect>
          </label>
          <label className="field" htmlFor={`task-${task.id}-field-156`}>
            <span>Priority</span>
            <WorkspaceSelect
              className="input"
              defaultValue={task.priority}
              name="priority"
              id={`task-${task.id}-field-156`}
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
        </div>
        <div className="row">
          <label className="field" htmlFor={`task-${task.id}-field-174`}>
            <span>Start date</span>
            <WorkspaceDatePicker
              className="input"
              defaultValue={task.startDate}
              name="startDate"
              id={`task-${task.id}-field-174`}
            />
          </label>
          <label className="field" htmlFor={`task-${task.id}-field-182`}>
            <span>Due date</span>
            <WorkspaceDatePicker
              className="input"
              defaultValue={task.dueDate}
              name="dueDate"
              id={`task-${task.id}-field-182`}
            />
          </label>
          <label className="field" htmlFor={`task-${task.id}-field-190`}>
            <span>Estimate</span>
            <WorkspaceInput
              className="input"
              defaultValue={task.estimate ?? ""}
              maxLength={40}
              name="estimate"
              id={`task-${task.id}-field-190`}
            />
          </label>
        </div>
        <fieldset className="field">
          <legend>Assignees</legend>
          <label className="field" htmlFor={`task-${task.id}-assignee-search`}>
            <span className="sr-only">Search employees</span>
            <WorkspaceInput
              autoComplete="off"
              className="input"
              id={`task-${task.id}-assignee-search`}
              onChange={(event) => setAssigneeSearch(event.currentTarget.value)}
              placeholder="Search employees"
              type="search"
              value={assigneeSearch}
            />
          </label>
          {employees.map((employee) => (
            <label
              className="row"
              hidden={
                !employee.name
                  .toLocaleLowerCase()
                  .includes(assigneeSearch.trim().toLocaleLowerCase())
              }
              key={employee.id}
              htmlFor={`task-${task.id}-employee-${employee.id}`}
            >
              <Checkbox
                defaultChecked={selectedAssigneeIds.has(employee.id)}
                name="assigneeIds"
                value={employee.id}
                id={`task-${task.id}-employee-${employee.id}`}
              />
              <span>{employee.name}</span>
            </label>
          ))}
        </fieldset>
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
          {pending ? "Saving…" : "Save task"}
        </WorkspaceButton>
      </form>
    </WorkspaceModal>
  );
};
