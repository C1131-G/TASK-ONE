/* eslint-disable shadcn/no-unknown-classes */

"use client";

import type { ProjectTaskViewItem } from "@/features/projects/types/project-task-view-types";
import { TaskManageControls } from "@/features/tasks/components/task-manage-controls";
import { TaskStatusSelect } from "@/features/tasks/components/task-status-select";
import type { EmployeeDirectoryEntry } from "@/src/server/people/user-contracts";
import type { LabelSummary } from "@/src/server/tasks/label-management";

export const ProjectTaskList = ({
  currentUserId,
  editableTaskIds,
  employees,
  isAdmin,
  labels,
  projectKey,
  tasks,
}: {
  readonly currentUserId: string | null;
  readonly editableTaskIds: ReadonlySet<string>;
  readonly employees: readonly EmployeeDirectoryEntry[];
  readonly isAdmin: boolean;
  readonly labels: readonly LabelSummary[];
  readonly projectKey: string;
  readonly tasks: readonly ProjectTaskViewItem[];
}) => {
  const labelsById = new Map(labels.map((label) => [label.id, label]));
  return (
    <div className="list-wrap project-task-list-wrap">
      <div className="tlist project-task-list">
        <div className="thead">
          <div>Task</div>
          <div>Status</div>
          <div>Priority</div>
          <div>Assignees</div>
          <div>Due date</div>
          <div>Labels</div>
          <div>Actions</div>
        </div>
        {tasks.map((task) => (
          <div className="trow" key={task.id}>
            <div className="ttl">
              <span className="mono faint">
                {projectKey}-{task.projectTaskNumber}
              </span>
              <span className="trunc">{task.title}</span>
              {task.subtaskCount ? (
                <span className="meta-mini">
                  {task.completedSubtaskCount}/{task.subtaskCount} subtasks
                </span>
              ) : null}
            </div>
            <div className="c-meta">
              {editableTaskIds.has(task.id) ? (
                <TaskStatusSelect
                  status={task.status}
                  taskId={task.id}
                  version={task.version}
                />
              ) : (
                <span className={`pstatus ${task.status}`}>{task.status}</span>
              )}
            </div>
            <div className="c-meta">{task.priority}</div>
            <div className="c-meta project-task-list-assignees">
              {task.assignees.length
                ? task.assignees.map((assignee) => assignee.name).join(", ")
                : "Unassigned"}
            </div>
            <div className="c-meta num">{task.dueDate ?? "—"}</div>
            <div className="c-meta c-lbl project-task-list-labels">
              {task.labelIds.flatMap((id) => {
                const label = labelsById.get(id);
                return label
                  ? [
                      <span className="lbl" key={label.id}>
                        {label.name}
                      </span>,
                    ]
                  : [];
              })}
            </div>
            <div className="c-meta">
              <TaskManageControls
                canEdit={editableTaskIds.has(task.id)}
                currentUserId={currentUserId}
                employees={employees}
                isAdmin={isAdmin}
                task={task}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
