/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import { WorkspaceDatePicker } from "@/components/workspace/workspace-date-picker";
import { WorkspaceModal } from "@/components/workspace/workspace-modal";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";
import { bulkUpdateTasksAction } from "@/features/tasks/tasks-actions";
import type { EmployeeDirectoryEntry } from "@/src/server/people/user-contracts";
import type { ProjectTaskListItem } from "@/src/server/work/work-contracts";

type SelectableTask = Pick<ProjectTaskListItem, "id" | "version">;

export const GlobalTaskBulkDialog = ({
  tasks,
  employees,
  onSuccess,
}: {
  readonly tasks: readonly SelectableTask[];
  readonly employees: readonly EmployeeDirectoryEntry[];
  readonly onSuccess: () => void;
}) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("unset");
  const [priority, setPriority] = useState("unset");
  const [dueDateMode, setDueDateMode] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assigneeMode, setAssigneeMode] = useState("");
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<ReadonlySet<string>>(
    new Set()
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ready =
    tasks.length > 0 &&
    status !== "unset" &&
    priority !== "unset" &&
    dueDateMode !== "" &&
    (dueDateMode !== "set" || dueDate !== "") &&
    assigneeMode !== "" &&
    (assigneeMode !== "selected" || assigneeIds.size > 0);

  const toggleAssignee = (id: string, checked: boolean) => {
    setAssigneeIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const resetForm = () => {
    setStatus("unset");
    setPriority("unset");
    setDueDateMode("");
    setDueDate("");
    setAssigneeMode("");
    setAssigneeIds(new Set());
    setError(null);
  };

  const submit = () => {
    if (!ready || pending) {
      return;
    }
    startTransition(async () => {
      const result = await bulkUpdateTasksAction({
        changes: {
          assigneeIds: assigneeMode === "unassigned" ? [] : [...assigneeIds],
          dueDate: dueDateMode === "clear" ? null : dueDate,
          priority,
          status,
        },
        idempotencyKey: crypto.randomUUID(),
        targets: tasks.map(({ id, version }) => ({
          expectedVersion: version,
          taskId: id,
        })),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setOpen(false);
      resetForm();
      onSuccess();
      router.refresh();
    });
  };

  const onOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetForm();
    }
  };

  return (
    <WorkspaceModal
      description={`Set status, priority, due date, and assignees for ${tasks.length} selected tasks.`}
      onOpenChange={onOpenChange}
      open={open}
      title="Update selected tasks"
      trigger={
        <WorkspaceButton size="sm" type="button" variant="secondary">
          Edit {tasks.length} selected
        </WorkspaceButton>
      }
    >
      <form
        className="stack global-task-bulk-form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <p className="muted">
          Each choice replaces that field on every selected task. The update is
          applied as one transaction.
        </p>
        <label className="field" htmlFor="global-bulk-status">
          <span>Status</span>
          <WorkspaceSelect
            ariaLabel="Set status for selected tasks"
            id="global-bulk-status"
            onValueChange={setStatus}
            value={status}
          >
            <WorkspaceSelectItem value="unset">
              Choose a status
            </WorkspaceSelectItem>
            <WorkspaceSelectItem value="backlog">Backlog</WorkspaceSelectItem>
            <WorkspaceSelectItem value="todo">To Do</WorkspaceSelectItem>
            <WorkspaceSelectItem value="progress">
              In Progress
            </WorkspaceSelectItem>
            <WorkspaceSelectItem value="review">Review</WorkspaceSelectItem>
            <WorkspaceSelectItem value="done">Done</WorkspaceSelectItem>
          </WorkspaceSelect>
        </label>
        <label className="field" htmlFor="global-bulk-priority">
          <span>Priority</span>
          <WorkspaceSelect
            ariaLabel="Set priority for selected tasks"
            id="global-bulk-priority"
            onValueChange={setPriority}
            value={priority}
          >
            <WorkspaceSelectItem value="unset">
              Choose a priority
            </WorkspaceSelectItem>
            <WorkspaceSelectItem value="urgent">Urgent</WorkspaceSelectItem>
            <WorkspaceSelectItem value="high">High</WorkspaceSelectItem>
            <WorkspaceSelectItem value="medium">Medium</WorkspaceSelectItem>
            <WorkspaceSelectItem value="low">Low</WorkspaceSelectItem>
            <WorkspaceSelectItem value="none">No priority</WorkspaceSelectItem>
          </WorkspaceSelect>
        </label>
        <fieldset className="field">
          <legend>Due date</legend>
          <RadioGroup
            aria-label="Choose how to update due dates"
            onValueChange={setDueDateMode}
            value={dueDateMode}
          >
            <label className="row" htmlFor="global-bulk-due-set">
              <RadioGroupItem id="global-bulk-due-set" value="set" />
              Set a date
            </label>
            <label className="row" htmlFor="global-bulk-due-clear">
              <RadioGroupItem id="global-bulk-due-clear" value="clear" />
              Clear due dates
            </label>
          </RadioGroup>
          {dueDateMode === "set" ? (
            <WorkspaceDatePicker
              ariaLabel="New due date for selected tasks"
              onValueChange={setDueDate}
              value={dueDate}
            />
          ) : null}
        </fieldset>
        <fieldset className="field">
          <legend>Assignees</legend>
          <RadioGroup
            aria-label="Choose how to update assignees"
            onValueChange={setAssigneeMode}
            value={assigneeMode}
          >
            <label className="row" htmlFor="global-bulk-assignees-selected">
              <RadioGroupItem
                id="global-bulk-assignees-selected"
                value="selected"
              />
              Replace with selected employees
            </label>
            <label className="row" htmlFor="global-bulk-assignees-none">
              <RadioGroupItem
                id="global-bulk-assignees-none"
                value="unassigned"
              />
              Make unassigned
            </label>
          </RadioGroup>
          {assigneeMode === "selected" ? (
            <div className="stack global-task-bulk-assignees">
              <label className="field" htmlFor="global-bulk-assignee-search">
                <span className="sr-only">Search employees</span>
                <WorkspaceInput
                  autoComplete="off"
                  className="input"
                  id="global-bulk-assignee-search"
                  onChange={(event) =>
                    setAssigneeSearch(event.currentTarget.value)
                  }
                  placeholder="Search employees"
                  type="search"
                  value={assigneeSearch}
                />
              </label>
              {employees.map((employee) => (
                <label
                  className="row"
                  htmlFor={`global-bulk-${employee.id}`}
                  hidden={
                    !employee.name
                      .toLocaleLowerCase()
                      .includes(assigneeSearch.trim().toLocaleLowerCase())
                  }
                  key={employee.id}
                >
                  <Checkbox
                    checked={assigneeIds.has(employee.id)}
                    id={`global-bulk-${employee.id}`}
                    onCheckedChange={(checked) =>
                      toggleAssignee(employee.id, checked === true)
                    }
                  />
                  {employee.name}
                </label>
              ))}
            </div>
          ) : null}
        </fieldset>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <WorkspaceButton disabled={!ready || pending} type="submit">
          {pending ? "Updating tasks…" : `Update ${tasks.length} tasks`}
        </WorkspaceButton>
      </form>
    </WorkspaceModal>
  );
};
