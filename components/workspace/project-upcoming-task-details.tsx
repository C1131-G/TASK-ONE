/* eslint-disable shadcn/no-unknown-classes, shadcn/no-restyle */

"use client";

import { useState } from "react";

import { TaskDetailsPanel } from "@/components/workspace/task-details-panel";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import type { EmployeeDirectoryEntry } from "@/src/server/people/user-contracts";
import type { ProjectTaskListItem } from "@/src/server/work/work-contracts";

export const ProjectUpcomingTaskDetails = ({
  canEdit,
  currentUserId,
  employees,
  isAdmin,
  task,
}: {
  readonly canEdit: boolean;
  readonly currentUserId: string | null;
  readonly employees: readonly EmployeeDirectoryEntry[];
  readonly isAdmin: boolean;
  readonly task: Pick<
    ProjectTaskListItem,
    | "dependencyIds"
    | "dueDate"
    | "id"
    | "labelIds"
    | "projectId"
    | "recurrence"
    | "title"
    | "version"
  >;
}) => {
  const [versionState, setVersionState] = useState({
    sourceVersion: task.version,
    value: task.version,
  });
  const version =
    versionState.sourceVersion === task.version
      ? versionState.value
      : task.version;

  return (
    <TaskDetailsPanel
      currentUserId={currentUserId}
      editable={canEdit}
      employees={employees}
      isAdmin={isAdmin}
      onVersionChange={(value) =>
        setVersionState({ sourceVersion: task.version, value })
      }
      projectId={task.projectId}
      taskId={task.id}
      trigger={
        <WorkspaceButton
          aria-label={`Open details for ${task.title}`}
          className="project-upcoming-title"
          type="button"
        >
          {task.title}
        </WorkspaceButton>
      }
      version={version}
    />
  );
};
