/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

/* eslint-disable jsx-a11y/label-has-associated-control */

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateTaskAction } from "@/app/actions/tasks";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import {
  WorkspaceInput,
  WorkspaceTextarea,
} from "@/components/workspace/workspace-controls";
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
  onVersionChange,
  onCompletionUndo,
}: {
  readonly task: EditableTask;
  readonly employees: readonly EmployeeOption[];
  readonly version: number;
  readonly onVersionChange: (version: number) => void;
  readonly onCompletionUndo: (
    undo: { readonly undoId: string; readonly expiresAt: string } | null
  ) => void;
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
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
      router.refresh();
    });

  return (
    <details>
      <summary aria-label={`Edit ${task.title}`} className="ibtn ibtn-sm">
        Edit
      </summary>
      <form
        className="panel-b stack"
        onSubmit={(event) => {
          event.preventDefault();
          update(new FormData(event.currentTarget));
        }}
      >
        <label className="field">
          <span>Title</span>
          <WorkspaceInput
            className="input"
            defaultValue={task.title}
            maxLength={200}
            name="title"
            required
          />
        </label>
        <label className="field">
          <span>Description</span>
          <WorkspaceTextarea
            className="input"
            defaultValue={task.description ?? ""}
            maxLength={10_000}
            name="description"
            rows={3}
          />
        </label>
        <div className="row">
          <label className="field">
            <span>Status</span>
            <select className="input" defaultValue={task.status} name="status">
              <option value="backlog">Backlog</option>
              <option value="todo">To Do</option>
              <option value="progress">In Progress</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
            </select>
          </label>
          <label className="field">
            <span>Priority</span>
            <select
              className="input"
              defaultValue={task.priority}
              name="priority"
            >
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="none">No priority</option>
            </select>
          </label>
        </div>
        <div className="row">
          <label className="field">
            <span>Start date</span>
            <WorkspaceInput
              className="input"
              defaultValue={task.startDate ?? ""}
              name="startDate"
              type="date"
            />
          </label>
          <label className="field">
            <span>Due date</span>
            <WorkspaceInput
              className="input"
              defaultValue={task.dueDate ?? ""}
              name="dueDate"
              type="date"
            />
          </label>
          <label className="field">
            <span>Estimate</span>
            <WorkspaceInput
              className="input"
              defaultValue={task.estimate ?? ""}
              maxLength={40}
              name="estimate"
            />
          </label>
        </div>
        <fieldset className="field">
          <legend>Assignees</legend>
          {employees.map((employee) => (
            <label className="row" key={employee.id}>
              <input
                defaultChecked={selectedAssigneeIds.has(employee.id)}
                name="assigneeIds"
                type="checkbox"
                value={employee.id}
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
    </details>
  );
};
