"use client";

/* eslint-disable shadcn/no-unknown-classes, shadcn/no-restyle */
// Cards are the draggable containers; Alt+arrow reordering is their keyboard path.
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */

import {
  ArrowDown,
  ArrowUp,
  CheckCircle,
  ListChecks,
  Repeat,
} from "@phosphor-icons/react";

import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import { TaskManageControls } from "@/components/workspace/task-manage-controls";
import { TaskStatusSelect } from "@/components/workspace/task-status-select";
import type { LabelSummary } from "@/src/server/tasks/label-management";

import type { BoardColumn, BoardTask } from "./project-board-types";

export const ProjectBoardCard = ({
  canEdit,
  canReorder,
  currentUserId,
  employees,
  isAdmin,
  labelsById,
  onMove,
  onDragCancel,
  onDragStart,
  projectKey,
  reorderPending,
  task,
  column,
}: {
  readonly canEdit: boolean;
  readonly canReorder: boolean;
  readonly currentUserId: string | null;
  readonly employees: React.ComponentProps<
    typeof TaskManageControls
  >["employees"];
  readonly isAdmin: boolean;
  readonly labelsById: ReadonlyMap<string, LabelSummary>;
  readonly onMove: (
    taskId: string,
    direction: -1 | 1,
    column: BoardColumn
  ) => void;
  readonly onDragCancel: () => void;
  readonly onDragStart: (taskId: string) => void;
  readonly projectKey: string;
  readonly reorderPending: boolean;
  readonly task: BoardTask;
  readonly column: BoardColumn;
}) => (
  <article
    tabIndex={0}
    aria-labelledby={`task-${task.id}-title`}
    className={`kcard${task.status === "done" ? " done" : ""}`}
    draggable={canEdit && !reorderPending}
    key={task.id}
    onKeyDown={(event) => {
      if (!canEdit || !event.altKey) {
        return;
      }
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        onMove(task.id, event.key === "ArrowUp" ? -1 : 1, column);
      }
    }}
    onDragEnd={() => {
      onDragCancel();
    }}
    onDragStart={() => {
      onDragStart(task.id);
    }}
  >
    {task.labelIds.length > 0 ? (
      <div className="labels">
        {task.labelIds.flatMap((labelId) => {
          const label = labelsById.get(labelId);
          return label ? (
            <span
              className="lbl"
              key={label.id}
              style={{ "--c": label.color } as React.CSSProperties}
            >
              <span aria-hidden="true" className="lbl-dot" />
              {label.name}
            </span>
          ) : (
            []
          );
        })}
      </div>
    ) : null}
    <div className="top">
      {task.status === "done" ? (
        <span className="done-ic">
          <CheckCircle aria-hidden="true" size={15} />
          <span className="sr-only">Completed</span>
        </span>
      ) : null}
      <span className="key">
        {projectKey}-{task.projectTaskNumber}
      </span>
      <h3 className="title" id={`task-${task.id}-title`}>
        {task.title}
      </h3>
    </div>
    {task.subtaskCount > 0 ? (
      <div className="subp">
        <ListChecks aria-hidden="true" size={13} />
        <span>
          {task.completedSubtaskCount}/{task.subtaskCount}
        </span>
        <progress
          aria-label={`${task.completedSubtaskCount} of ${task.subtaskCount} subtasks complete`}
          className="board-subtask-progress"
          max={task.subtaskCount}
          value={task.completedSubtaskCount}
        />
      </div>
    ) : null}
    <div className="meta">
      <span className="m">{task.priority}</span>
      {task.dueDate ? <span className="m">{task.dueDate}</span> : null}
      {canEdit ? (
        <TaskStatusSelect
          status={task.status}
          taskId={task.id}
          version={task.version}
        />
      ) : null}
      {canEdit && canReorder ? (
        <span className="board-move">
          <button
            aria-label={`Move ${task.title} up`}
            className="ibtn ibtn-xs"
            disabled={reorderPending}
            onClick={() => onMove(task.id, -1, column)}
            type="button"
          >
            <ArrowUp aria-hidden="true" size={13} />
          </button>
          <button
            aria-label={`Move ${task.title} down`}
            className="ibtn ibtn-xs"
            disabled={reorderPending}
            onClick={() => onMove(task.id, 1, column)}
            type="button"
          >
            <ArrowDown aria-hidden="true" size={13} />
          </button>
        </span>
      ) : null}
      {task.recurrence ? (
        <span className="m">
          <Repeat aria-hidden="true" size={13} />
          <span className="sr-only">Recurring task</span>
        </span>
      ) : null}
      {task.assignees.length > 0 ? (
        <AvatarGroup className="avs">
          {task.assignees.slice(0, 3).map((assignee) => {
            const initials = assignee.name
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase() ?? "")
              .join("");
            return (
              <Avatar className="av sm" key={assignee.id} size="sm">
                <AvatarFallback className="av-fallback">
                  {initials}
                  <span className="sr-only">{assignee.name}</span>
                </AvatarFallback>
              </Avatar>
            );
          })}
          {task.assignees.length > 3 ? (
            <AvatarGroupCount className="av sm more">
              <span aria-hidden="true">+{task.assignees.length - 3}</span>
              <span className="sr-only">
                {task.assignees.length - 3} more assignees
              </span>
            </AvatarGroupCount>
          ) : null}
        </AvatarGroup>
      ) : null}
    </div>
    <TaskManageControls
      canEdit={canEdit}
      currentUserId={currentUserId}
      employees={employees}
      isAdmin={isAdmin}
      task={task}
    />
  </article>
);
