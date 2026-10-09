/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

/* eslint-disable jsx-a11y/label-has-associated-control */

"use client";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import {
  WorkspaceInput,
  WorkspaceTextarea,
} from "@/components/workspace/workspace-controls";

export interface TaskCommentView {
  readonly id: string;
  readonly taskId: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly body: string;
  readonly createdAt: string;
  readonly reactions: readonly {
    readonly emoji: string;
    readonly count: number;
    readonly reacted: boolean;
  }[];
}

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

export interface TaskRelationOption {
  readonly id: string;
  readonly name: string;
}

export interface TaskLabelOption extends TaskRelationOption {
  readonly color: string;
}

export const TaskRelationsSection = ({
  labels,
  dependencies,
  selectedLabelIds,
  selectedDependencyIds,
  editable,
  pending,
  onSave,
}: {
  readonly labels: readonly TaskLabelOption[];
  readonly dependencies: readonly TaskRelationOption[];
  readonly selectedLabelIds: readonly string[];
  readonly selectedDependencyIds: readonly string[];
  readonly editable: boolean;
  readonly pending: boolean;
  readonly onSave: (formData: FormData) => void;
}) => {
  const selectedLabels = new Set(selectedLabelIds);
  const selectedDependencies = new Set(selectedDependencyIds);
  return (
    <section className="stack">
      <h3>Labels and dependencies</h3>
      {editable ? (
        <form action={onSave} className="stack">
          <fieldset className="field">
            <legend>Labels</legend>
            {labels.length ? (
              labels.map((label) => (
                <label className="row" key={label.id}>
                  <input
                    defaultChecked={selectedLabels.has(label.id)}
                    name="labelIds"
                    type="checkbox"
                    value={label.id}
                  />
                  <span
                    className="pdot"
                    style={{ "--c": label.color } as React.CSSProperties}
                  />
                  <span>{label.name}</span>
                </label>
              ))
            ) : (
              <p className="muted">No labels are available.</p>
            )}
          </fieldset>
          <fieldset className="field">
            <legend>Blocked by</legend>
            {dependencies.length ? (
              dependencies.map((dependency) => (
                <label className="row" key={dependency.id}>
                  <input
                    defaultChecked={selectedDependencies.has(dependency.id)}
                    name="dependencyTaskIds"
                    type="checkbox"
                    value={dependency.id}
                  />
                  <span>{dependency.name}</span>
                </label>
              ))
            ) : (
              <p className="muted">No other project tasks are available.</p>
            )}
          </fieldset>
          <WorkspaceButton
            className="btn btn-sm btn-secondary"
            disabled={pending}
            type="submit"
          >
            Save labels and dependencies
          </WorkspaceButton>
        </form>
      ) : (
        <div className="stack">
          <p className="muted">
            Labels:{" "}
            {labels
              .flatMap((label) =>
                selectedLabels.has(label.id) ? [label.name] : []
              )
              .join(", ") || "None"}
          </p>
          <p className="muted">
            Blocked by:{" "}
            {dependencies
              .flatMap((dependency) =>
                selectedDependencies.has(dependency.id) ? [dependency.name] : []
              )
              .join(", ") || "None"}
          </p>
        </div>
      )}
    </section>
  );
};

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
        <WorkspaceInput
          aria-label={`Mark ${subtask.title} ${subtask.completed ? "incomplete" : "complete"}`}
          checked={subtask.completed}
          disabled={!editable || pending}
          onChange={() => onToggle(subtask)}
          type="checkbox"
        />
        <span className="grow">{subtask.title}</span>
        {editable ? (
          <details>
            <summary
              aria-label={`Edit ${subtask.title}`}
              className="btn btn-sm btn-ghost"
            >
              Edit
            </summary>
            <form
              action={(formData) => onUpdate(subtask, formData)}
              className="panel-b stack"
            >
              <label className="field">
                <span>Title</span>
                <WorkspaceInput
                  className="input"
                  defaultValue={subtask.title}
                  maxLength={240}
                  name="title"
                  required
                />
              </label>
              <label className="field">
                <span>Notes</span>
                <WorkspaceTextarea
                  className="input"
                  defaultValue={subtask.description ?? ""}
                  maxLength={10_000}
                  name="description"
                  rows={2}
                />
              </label>
              <div className="row">
                <label className="field">
                  <span>Due date</span>
                  <WorkspaceInput
                    className="input"
                    defaultValue={subtask.dueDate ?? ""}
                    name="dueDate"
                    type="date"
                  />
                </label>
                <label className="field">
                  <span>Assignee</span>
                  <select
                    className="input"
                    defaultValue={subtask.assigneeId ?? ""}
                    name="assigneeId"
                  >
                    <option value="">Unassigned</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
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
          </details>
        ) : null}
        {editable ? (
          <WorkspaceButton
            aria-label={`Move ${subtask.title} up`}
            className="ibtn ibtn-sm"
            disabled={pending || index === 0}
            onClick={() => onReorder(index, -1)}
            type="button"
          >
            ↑
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
            ↓
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

export const TaskCommentsSection = ({
  comments,
  currentUserId,
  isAdmin,
  pending,
  body,
  onBodyChange,
  onSubmit,
  onRemove,
  undoAvailable,
  onUndo,
  onReact,
}: {
  readonly comments: readonly TaskCommentView[];
  readonly currentUserId: string | null;
  readonly isAdmin: boolean;
  readonly pending: boolean;
  readonly body: string;
  readonly onBodyChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly onRemove: (commentId: string) => void;
  readonly undoAvailable: boolean;
  readonly onUndo: () => void;
  readonly onReact: (comment: TaskCommentView, emoji: string) => void;
}) => (
  <section className="stack">
    <h3>Comments</h3>
    {comments.map((comment) => (
      <article className="panel panel-b comment" key={comment.id}>
        <div className="row">
          <strong>{comment.authorName}</strong>
          <time className="muted" dateTime={comment.createdAt}>
            {comment.createdAt.slice(0, 10)}
          </time>
          <span className="sp" />
          {isAdmin || comment.authorId === currentUserId ? (
            <WorkspaceButton
              className="ibtn ibtn-sm"
              disabled={pending}
              onClick={() => onRemove(comment.id)}
              type="button"
            >
              Remove
            </WorkspaceButton>
          ) : null}
        </div>
        <p>{comment.body}</p>
        <div className="row">
          {comment.reactions.map((reaction) => (
            <WorkspaceButton
              aria-pressed={reaction.reacted}
              className="btn btn-sm btn-ghost"
              disabled={pending}
              key={reaction.emoji}
              onClick={() => onReact(comment, reaction.emoji)}
              type="button"
            >
              {reaction.emoji} {reaction.count}
            </WorkspaceButton>
          ))}
          {["👍", "❤️", "🎉"].map((emoji) => (
            <WorkspaceButton
              aria-label={`React ${emoji}`}
              className="ibtn ibtn-sm"
              disabled={pending}
              key={`add-${emoji}`}
              onClick={() => onReact(comment, emoji)}
              type="button"
            >
              {emoji}
            </WorkspaceButton>
          ))}
        </div>
      </article>
    ))}
    {undoAvailable ? (
      <WorkspaceButton
        className="btn btn-sm btn-ghost"
        onClick={onUndo}
        type="button"
      >
        Undo comment removal
      </WorkspaceButton>
    ) : null}
    <label className="field">
      <span>Add a comment</span>
      <WorkspaceTextarea
        className="input"
        maxLength={10_000}
        onChange={(event) => onBodyChange(event.currentTarget.value)}
        value={body}
      />
    </label>
    <WorkspaceButton
      className="btn btn-sm btn-primary"
      disabled={pending || !body.trim()}
      onClick={onSubmit}
      type="button"
    >
      Comment
    </WorkspaceButton>
  </section>
);
