/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, shadcn/no-unknown-classes */

"use client";

import Link from "next/link";
import { useOptimistic, useRef, useState, useTransition } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { FavoriteToggle } from "@/features/discovery/components/favorite-toggle";
import { BoardCardTransition } from "@/features/tasks/components/board-card-transition";
import { TaskManageControls } from "@/features/tasks/components/task-manage-controls";
import { TaskStatusSelect } from "@/features/tasks/components/task-status-select";
import { withTaskStatus } from "@/features/tasks/task-status-move";
import { changeTaskColumnAction } from "@/features/tasks/tasks-actions";
import type { EmployeeDirectoryEntry } from "@/src/server/people/user-contracts";
import type { ProjectTaskListItem } from "@/src/server/work/work-contracts";

type GlobalTask = Omit<
  ProjectTaskListItem,
  "completionUndo" | "recurrenceSuccessorId"
> & {
  readonly projectKey: string;
  readonly projectName: string;
};

interface TaskGroup {
  readonly key: string;
  readonly tasks: readonly GlobalTask[];
}

const TASK_STATUSES = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "To Do" },
  { id: "progress", label: "In Progress" },
  { id: "review", label: "Review" },
  { id: "done", label: "Done" },
] as const;

export const GlobalTaskBoard = ({
  taskGroups,
  favoriteTaskIds,
  employees,
  userId,
  isAdmin,
  selectedIds,
  onToggle,
}: {
  readonly taskGroups: readonly TaskGroup[];
  readonly favoriteTaskIds: ReadonlySet<string>;
  readonly employees: readonly EmployeeDirectoryEntry[];
  readonly userId: string | null;
  readonly isAdmin: boolean;
  readonly selectedIds: ReadonlySet<string>;
  readonly onToggle: (taskId: string, checked: boolean) => void;
}) => {
  const draggedTaskId = useRef<string | null>(null);
  const moveInFlight = useRef(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // A dropped card sits in its new column at once; a refused move falls back.
  const [tasks, showMove] = useOptimistic(
    taskGroups.flatMap((group) => group.tasks),
    withTaskStatus<GlobalTask>
  );
  const moveTask = (status: (typeof TASK_STATUSES)[number]["id"]) => {
    if (pending || moveInFlight.current) {
      return;
    }
    const task = tasks.find(({ id }) => id === draggedTaskId.current);
    draggedTaskId.current = null;
    if (!task || task.status === status) {
      return;
    }
    moveInFlight.current = true;
    startTransition(async () => {
      showMove({ status, taskId: task.id });
      try {
        const result = await changeTaskColumnAction({
          expectedVersion: task.version,
          idempotencyKey: crypto.randomUUID(),
          status,
          taskId: task.id,
        });
        if (result.ok) {
          setError(null);
        } else {
          setError(result.error.message);
        }
      } catch {
        setError("Task could not be moved. Try again.");
      }
      moveInFlight.current = false;
    });
  };

  return (
    <div className="project-board-wrap global-task-board-wrap">
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <div aria-busy={pending} className="board global-task-board">
        {TASK_STATUSES.map((status) => {
          const statusTasks = tasks.filter((task) => task.status === status.id);
          return (
            <section
              aria-label={`${status.label}, ${statusTasks.length} tasks`}
              className="bcol"
              key={status.id}
            >
              <header className="bcol-h">
                <span aria-hidden="true" className={`st ${status.id}`} />
                <span>{status.label}</span>
                <span className="cnt">{statusTasks.length}</span>
              </header>
              <div
                className="bcol-b"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  moveTask(status.id);
                }}
              >
                {statusTasks.map((task) => {
                  const canEdit =
                    isAdmin ||
                    task.createdById === userId ||
                    task.assigneeIds.includes(userId ?? "");
                  return (
                    <BoardCardTransition key={task.id} taskId={task.id}>
                      <article
                        className={`kcard${task.status === "done" ? " done" : ""}`}
                        draggable={canEdit && !pending}
                        onDragEnd={() => {
                          draggedTaskId.current = null;
                        }}
                        onDragStart={() => {
                          draggedTaskId.current = task.id;
                        }}
                      >
                        <div className="top">
                          <Checkbox
                            aria-label={`Select ${task.title}`}
                            checked={selectedIds.has(task.id)}
                            onCheckedChange={(checked) =>
                              onToggle(task.id, checked === true)
                            }
                          />
                          <span className="key">
                            {task.projectKey}-{task.projectTaskNumber}
                          </span>
                          <h3 className="title">
                            <Link
                              href={`/projects/${task.projectId}?view=board`}
                            >
                              {task.title}
                            </Link>
                          </h3>
                        </div>
                        <div className="meta">
                          <span className="m">{task.projectName}</span>
                          <span className="m">{task.priority}</span>
                          {task.dueDate ? (
                            <span className="m">{task.dueDate}</span>
                          ) : null}
                          <span className="m">
                            {task.assignees
                              .map(({ name }) => name)
                              .join(", ") || "Unassigned"}
                          </span>
                        </div>
                        {canEdit ? (
                          <TaskStatusSelect
                            status={task.status}
                            taskId={task.id}
                            version={task.version}
                          />
                        ) : (
                          <span className={`pstatus ${task.status}`}>
                            {task.status}
                          </span>
                        )}
                        <div className="c-meta row">
                          <FavoriteToggle
                            id={task.id}
                            initialFavorite={favoriteTaskIds.has(task.id)}
                            kind="task"
                          />
                          <TaskManageControls
                            canEdit={canEdit}
                            currentUserId={userId}
                            employees={employees}
                            isAdmin={isAdmin}
                            task={task}
                          />
                        </div>
                      </article>
                    </BoardCardTransition>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
