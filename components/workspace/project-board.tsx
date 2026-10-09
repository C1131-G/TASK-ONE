/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, shadcn/no-unknown-classes */

"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { changeTaskColumnAction } from "@/app/actions/tasks";
import { TaskManageControls } from "@/components/workspace/task-manage-controls";
import { TaskStatusSelect } from "@/components/workspace/task-status-select";
import type { TaskRecurrenceInput } from "@/src/server/work/work-contracts";

interface Task {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly status: "backlog" | "todo" | "progress" | "review" | "done";
  readonly priority: "urgent" | "high" | "medium" | "low" | "none";
  readonly version: number;
  readonly createdById: string;
  readonly assigneeIds: readonly string[];
  readonly description: string | null;
  readonly dueDate: string | null;
  readonly startDate: string | null;
  readonly estimate: string | null;
  readonly projectTaskNumber: number;
  readonly labelIds: readonly string[];
  readonly dependencyIds: readonly string[];
  readonly recurrence: TaskRecurrenceInput | null;
}

interface Employee {
  readonly id: string;
  readonly name: string;
}

const columns = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "To Do" },
  { id: "progress", label: "In Progress" },
  { id: "review", label: "Review" },
  { id: "done", label: "Done" },
] as const;

export const ProjectBoard = ({
  projectKey,
  tasks,
  employees,
  currentUserId,
  isAdmin,
}: {
  readonly projectKey: string;
  readonly tasks: readonly Task[];
  readonly employees: readonly Employee[];
  readonly currentUserId: string | null;
  readonly isAdmin: boolean;
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const draggedTaskId = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const moveTask = (status: Task["status"]) => {
    const task = tasks.find((item) => item.id === draggedTaskId.current);
    if (!task || task.status === status) {
      draggedTaskId.current = null;
      return;
    }
    startTransition(async () => {
      const result = await changeTaskColumnAction({
        expectedVersion: task.version,
        idempotencyKey: crypto.randomUUID(),
        status,
        taskId: task.id,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      router.refresh();
    });
    draggedTaskId.current = null;
  };

  return (
    <div className="project-board-wrap">
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <div aria-busy={pending} className="board">
        {columns.map((column) => {
          const columnTasks = tasks.filter((task) => task.status === column.id);
          return (
            <section
              aria-label={`${column.label}, ${columnTasks.length} tasks`}
              className="bcol"
              key={column.id}
            >
              <header className="bcol-h">
                <span className={`st ${column.id}`} aria-hidden="true" />
                <span>{column.label}</span>
                <span className="cnt">{columnTasks.length}</span>
              </header>
              <div
                aria-label={`Drop tasks in ${column.label}`}
                className="bcol-b"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  moveTask(column.id);
                }}
                role="application"
              >
                {columnTasks.map((task) => {
                  const canEdit =
                    isAdmin ||
                    task.createdById === currentUserId ||
                    task.assigneeIds.includes(currentUserId ?? "");
                  return (
                    <article
                      className={`kcard${task.status === "done" ? " done" : ""}`}
                      draggable={canEdit && !pending}
                      key={task.id}
                      onDragEnd={() => {
                        draggedTaskId.current = null;
                      }}
                      onDragStart={() => {
                        draggedTaskId.current = task.id;
                      }}
                    >
                      <div className="top">
                        <span className="key">
                          {projectKey}-{task.projectTaskNumber}
                        </span>
                        <span className="title">{task.title}</span>
                      </div>
                      <div className="meta">
                        <span className="m">{task.priority}</span>
                        {task.dueDate ? (
                          <span className="m">{task.dueDate}</span>
                        ) : null}
                        {canEdit ? (
                          <TaskStatusSelect
                            status={task.status}
                            taskId={task.id}
                            version={task.version}
                          />
                        ) : null}
                      </div>
                      {canEdit ? (
                        <TaskManageControls
                          currentUserId={currentUserId}
                          employees={employees}
                          isAdmin={isAdmin}
                          task={task}
                        />
                      ) : null}
                    </article>
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
