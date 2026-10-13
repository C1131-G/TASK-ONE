/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useEffect, useState, useTransition } from "react";
import type { FormEvent } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import {
  WorkspaceInput,
  WorkspaceTextarea,
} from "@/components/workspace/workspace-controls";
import { WorkspaceDatePicker } from "@/components/workspace/workspace-date-picker";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";
import { TaskAssigneesFieldset } from "@/features/tasks/components/task-assignees-fieldset";
import type { TaskEmployeeOption } from "@/features/tasks/components/task-assignees-fieldset";
import type {
  EditableTask,
  TaskDetailsDraft,
} from "@/features/tasks/task-details-draft";
import {
  draftFromTask,
  isDraftDirty,
} from "@/features/tasks/task-details-draft";
import { updateTaskAction } from "@/features/tasks/tasks-actions";

const TASK_STATUSES: readonly TaskDetailsDraft["status"][] = [
  "backlog",
  "todo",
  "progress",
  "review",
  "done",
];
const TASK_PRIORITIES: readonly TaskDetailsDraft["priority"][] = [
  "urgent",
  "high",
  "medium",
  "low",
  "none",
];

export const TaskDetailsForm = ({
  editable,
  employees,
  onDirtyChange,
  onReload,
  onSaved,
  task,
  version,
}: {
  readonly editable: boolean;
  readonly employees: readonly TaskEmployeeOption[];
  readonly onDirtyChange: (dirty: boolean) => void;
  readonly onReload: () => void;
  readonly onSaved: (
    version: number,
    completionUndo: {
      readonly undoId: string;
      readonly expiresAt: string;
    } | null
  ) => void;
  readonly task: EditableTask;
  // The panel keeps this current, so a save after a subtask edit is not a conflict.
  readonly version: number;
}) => {
  const [draft, setDraft] = useState(() => draftFromTask(task));
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [error, setError] = useState<{
    readonly conflict: boolean;
    readonly message: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = isDraftDirty(draft, task);

  // Dirty state is reported from the change handlers, not from an effect, so the
  // panel never re-renders just to mirror the form.
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const patch = (values: Partial<TaskDetailsDraft>) => {
    const next = { ...draft, ...values };
    setDraft(next);
    onDirtyChange(isDraftDirty(next, task));
  };
  const toggleAssignee = (employeeId: string, checked: boolean) => {
    const others = draft.assigneeIds.filter((id) => id !== employeeId);
    patch({
      assigneeIds: checked ? [...others, employeeId].toSorted() : others,
    });
  };

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateTaskAction({
        assigneeIds: draft.assigneeIds,
        description: draft.description.trim() || null,
        dueDate: draft.dueDate,
        estimate: draft.estimate.trim() || null,
        expectedVersion: version,
        idempotencyKey: crypto.randomUUID(),
        priority: draft.priority,
        startDate: draft.startDate,
        status: draft.status,
        taskId: task.id,
        title: draft.title.trim(),
      });
      if (!result.ok) {
        setError({
          conflict: result.error.code === "CONFLICT",
          message: result.error.message,
        });
        return;
      }
      setError(null);
      onSaved(result.data.version, result.data.completionUndo ?? null);
    });
  };

  const fieldId = (name: string) => `task-${task.id}-${name}`;

  return (
    <form className="stack" onSubmit={save}>
      <label className="field" htmlFor={fieldId("title")}>
        <span>Title</span>
        <WorkspaceInput
          className="input"
          disabled={!editable}
          id={fieldId("title")}
          maxLength={200}
          onChange={(event) => patch({ title: event.currentTarget.value })}
          required
          value={draft.title}
        />
      </label>
      <label className="field" htmlFor={fieldId("description")}>
        <span>Description</span>
        <WorkspaceTextarea
          className="input"
          disabled={!editable}
          id={fieldId("description")}
          maxLength={10_000}
          onChange={(event) =>
            patch({ description: event.currentTarget.value })
          }
          rows={3}
          value={draft.description}
        />
      </label>
      <div className="row">
        <label className="field" htmlFor={fieldId("status")}>
          <span>Status</span>
          <WorkspaceSelect
            className="input"
            disabled={!editable}
            id={fieldId("status")}
            onValueChange={(value) => {
              const status = TASK_STATUSES.find(
                (candidate) => candidate === value
              );
              if (status) {
                patch({ status });
              }
            }}
            value={draft.status}
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
        <label className="field" htmlFor={fieldId("priority")}>
          <span>Priority</span>
          <WorkspaceSelect
            className="input"
            disabled={!editable}
            id={fieldId("priority")}
            onValueChange={(value) => {
              const priority = TASK_PRIORITIES.find(
                (candidate) => candidate === value
              );
              if (priority) {
                patch({ priority });
              }
            }}
            value={draft.priority}
          >
            <WorkspaceSelectItem value="urgent">Urgent</WorkspaceSelectItem>
            <WorkspaceSelectItem value="high">High</WorkspaceSelectItem>
            <WorkspaceSelectItem value="medium">Medium</WorkspaceSelectItem>
            <WorkspaceSelectItem value="low">Low</WorkspaceSelectItem>
            <WorkspaceSelectItem value="none">No priority</WorkspaceSelectItem>
          </WorkspaceSelect>
        </label>
      </div>
      <div className="row">
        <label className="field" htmlFor={fieldId("start")}>
          <span>Start date</span>
          <WorkspaceDatePicker
            className="input"
            disabled={!editable}
            id={fieldId("start")}
            onValueChange={(value) => patch({ startDate: value || null })}
            value={draft.startDate}
          />
        </label>
        <label className="field" htmlFor={fieldId("due")}>
          <span>Due date</span>
          <WorkspaceDatePicker
            className="input"
            disabled={!editable}
            id={fieldId("due")}
            onValueChange={(value) => patch({ dueDate: value || null })}
            value={draft.dueDate}
          />
        </label>
        <label className="field" htmlFor={fieldId("estimate")}>
          <span>Estimate</span>
          <WorkspaceInput
            className="input"
            disabled={!editable}
            id={fieldId("estimate")}
            maxLength={40}
            onChange={(event) => patch({ estimate: event.currentTarget.value })}
            value={draft.estimate}
          />
        </label>
      </div>
      <TaskAssigneesFieldset
        editable={editable}
        employees={employees}
        onSearchChange={setAssigneeSearch}
        onToggle={toggleAssignee}
        search={assigneeSearch}
        selectedIds={draft.assigneeIds}
        taskId={task.id}
      />
      {error ? (
        <p className="error" role="alert">
          {error.message}
          {error.conflict ? (
            <>
              {" "}
              <WorkspaceButton
                className="btn btn-sm btn-ghost"
                onClick={onReload}
                type="button"
              >
                Reload task
              </WorkspaceButton>
            </>
          ) : null}
        </p>
      ) : null}
      {editable ? (
        <WorkspaceButton
          className="btn btn-primary"
          disabled={pending || !dirty}
          type="submit"
        >
          {pending ? "Saving…" : "Save details"}
        </WorkspaceButton>
      ) : null}
    </form>
  );
};
