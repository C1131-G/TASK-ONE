/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useEffect, useState, useTransition } from "react";
import type { FormEvent } from "react";

import { updateTaskAction } from "@/app/actions/tasks";
import { Checkbox } from "@/components/ui/checkbox";
import type {
  EditableTask,
  TaskDetailsDraft,
} from "@/components/workspace/task-details-draft";
import {
  draftFromTask,
  isDraftDirty,
} from "@/components/workspace/task-details-draft";
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

interface EmployeeOption {
  readonly id: string;
  readonly name: string;
}

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
  readonly employees: readonly EmployeeOption[];
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
  const assigneeSet = new Set(draft.assigneeIds);

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
  const visibleEmployees = employees.filter((employee) =>
    employee.name
      .toLocaleLowerCase()
      .includes(assigneeSearch.trim().toLocaleLowerCase())
  );

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
            onValueChange={(value) =>
              patch({ status: value as TaskDetailsDraft["status"] })
            }
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
            onValueChange={(value) =>
              patch({ priority: value as TaskDetailsDraft["priority"] })
            }
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
      <fieldset className="field">
        <legend>Assignees</legend>
        <label className="field" htmlFor={fieldId("assignee-search")}>
          <span className="sr-only">Search employees</span>
          <WorkspaceInput
            autoComplete="off"
            className="input"
            id={fieldId("assignee-search")}
            onChange={(event) => setAssigneeSearch(event.currentTarget.value)}
            placeholder="Search employees"
            type="search"
            value={assigneeSearch}
          />
        </label>
        {visibleEmployees.map((employee) => (
          <label
            className="row"
            htmlFor={fieldId(`employee-${employee.id}`)}
            key={employee.id}
          >
            <Checkbox
              checked={assigneeSet.has(employee.id)}
              disabled={!editable}
              id={fieldId(`employee-${employee.id}`)}
              onCheckedChange={(checked) =>
                toggleAssignee(employee.id, checked === true)
              }
            />
            <span>{employee.name}</span>
          </label>
        ))}
      </fieldset>
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
