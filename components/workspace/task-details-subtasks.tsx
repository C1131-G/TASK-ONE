/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { ArrowDown, ArrowUp } from "@phosphor-icons/react";

import { Checkbox } from "@/components/ui/checkbox";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceCombobox } from "@/components/workspace/workspace-combobox";
import {
  WorkspaceInput,
  WorkspaceTextarea,
} from "@/components/workspace/workspace-controls";
import { WorkspaceDatePicker } from "@/components/workspace/workspace-date-picker";
import { WorkspaceDisclosure } from "@/components/workspace/workspace-disclosure";

export interface TaskSubtaskView {
  readonly id: string;
  readonly taskId: string;
  readonly title: string;
  readonly description: string | null;
  readonly dueDate: string | null;
  readonly assigneeId: string | null;
  readonly position: number;
  readonly completed: boolean;
}

export const TaskSubtasksSection = ({
  subtasks,
  editable,
  pending,
  onAdd,
  onToggle,
  onRemove,
  onUpdate,
  onReorder,
  onPromote,
  employees,
}: {
  readonly subtasks: readonly TaskSubtaskView[];
  readonly editable: boolean;
  readonly pending: boolean;
  readonly onAdd: (formData: FormData) => void;
  readonly onToggle: (subtask: TaskSubtaskView) => void;
  readonly onRemove: (subtask: TaskSubtaskView) => void;
  readonly onUpdate: (subtask: TaskSubtaskView, formData: FormData) => void;
  readonly onReorder: (index: number, direction: -1 | 1) => void;
  readonly onPromote: (subtask: TaskSubtaskView) => void;
  readonly employees: readonly { readonly id: string; readonly name: string }[];
}) => (
  <section className="stack">
    <h3>Subtasks</h3>
    {subtasks.map((subtask, index) => (
      <div className="row" key={subtask.id}>
        <Checkbox
          aria-label={`Mark ${subtask.title} ${subtask.completed ? "incomplete" : "complete"}`}
          checked={subtask.completed}
          disabled={!editable || pending}
          onCheckedChange={() => onToggle(subtask)}
        />
        <span className="grow">{subtask.title}</span>
        {editable ? (
          <WorkspaceDisclosure
            description={`Edit the title, notes, due date, and assignee for ${subtask.title}.`}
            title={`Edit ${subtask.title}`}
            trigger={
              <WorkspaceButton
                aria-label={`Edit ${subtask.title}`}
                className="btn btn-sm btn-ghost"
                type="button"
              >
                Edit
              </WorkspaceButton>
            }
          >
            <form
              action={(formData) => onUpdate(subtask, formData)}
              className="panel-b stack"
            >
              <label
                className="field"
                htmlFor={`subtask-${subtask.id}-field-199`}
              >
                <span>Title</span>
                <WorkspaceInput
                  className="input"
                  defaultValue={subtask.title}
                  maxLength={240}
                  name="title"
                  required
                  id={`subtask-${subtask.id}-field-199`}
                />
              </label>
              <label
                className="field"
                htmlFor={`subtask-${subtask.id}-field-223`}
              >
                <span>Notes</span>
                <WorkspaceTextarea
                  className="input"
                  defaultValue={subtask.description ?? ""}
                  maxLength={10_000}
                  name="description"
                  rows={2}
                  id={`subtask-${subtask.id}-field-223`}
                />
              </label>
              <div className="row">
                <label
                  className="field"
                  htmlFor={`subtask-${subtask.id}-field-220`}
                >
                  <span>Due date</span>
                  <WorkspaceDatePicker
                    className="input"
                    defaultValue={subtask.dueDate ?? ""}
                    name="dueDate"
                    id={`subtask-${subtask.id}-field-220`}
                  />
                </label>
                <label
                  className="field"
                  htmlFor={`subtask-${subtask.id}-field-228`}
                >
                  <span>Assignee</span>
                  <WorkspaceCombobox
                    ariaLabel={`Choose assignee for ${subtask.title}`}
                    className="input"
                    defaultValue={subtask.assigneeId ?? ""}
                    emptyMessage="No employees found."
                    id={`subtask-${subtask.id}-field-228`}
                    key={`${subtask.id}-assignee-${subtask.assigneeId ?? "none"}`}
                    name="assigneeId"
                    options={[
                      { label: "Unassigned", value: "" },
                      ...employees.map((employee) => ({
                        label: employee.name,
                        value: employee.id,
                      })),
                    ]}
                    placeholder="Unassigned"
                    searchPlaceholder="Search employees"
                  />
                </label>
              </div>
              <WorkspaceButton
                className="btn btn-sm btn-secondary"
                disabled={pending}
                type="submit"
              >
                Save subtask
              </WorkspaceButton>
            </form>
          </WorkspaceDisclosure>
        ) : null}
        {editable ? (
          <WorkspaceButton
            aria-label={`Move ${subtask.title} up`}
            className="ibtn ibtn-sm"
            disabled={pending || index === 0}
            onClick={() => onReorder(index, -1)}
            type="button"
          >
            <ArrowUp aria-hidden="true" size={14} />
          </WorkspaceButton>
        ) : null}
        {editable && index < subtasks.length - 1 ? (
          <WorkspaceButton
            aria-label={`Move ${subtask.title} down`}
            className="ibtn ibtn-sm"
            disabled={pending}
            onClick={() => onReorder(index, 1)}
            type="button"
          >
            <ArrowDown aria-hidden="true" size={14} />
          </WorkspaceButton>
        ) : null}
        {editable && !subtask.completed ? (
          <WorkspaceButton
            className="btn btn-sm btn-ghost"
            disabled={pending}
            onClick={() => onPromote(subtask)}
            type="button"
          >
            Promote to task
          </WorkspaceButton>
        ) : null}
        {editable ? (
          <WorkspaceButton
            aria-label={`Remove ${subtask.title}`}
            className="ibtn ibtn-sm"
            disabled={pending}
            onClick={() => onRemove(subtask)}
            type="button"
          >
            Remove
          </WorkspaceButton>
        ) : null}
      </div>
    ))}
    {editable ? (
      <form action={onAdd} className="row">
        <WorkspaceInput
          aria-label="New subtask title"
          className="input grow"
          maxLength={240}
          name="title"
          placeholder="Add a subtask"
          required
        />
        <WorkspaceButton
          className="btn btn-sm btn-secondary"
          disabled={pending}
          type="submit"
        >
          Add
        </WorkspaceButton>
      </form>
    ) : null}
  </section>
);
