/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useState } from "react";

import { TaskDetailsPanel } from "@/components/workspace/task-details-panel";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import type { ProjectTaskListItemSchema } from "@/src/server/work/work-contracts";

type ProjectTask = typeof ProjectTaskListItemSchema.Type;

export const MemberProfileTaskDetails = ({
  employees,
  isAdmin,
  task,
  viewerId,
}: {
  readonly employees: readonly { readonly id: string; readonly name: string }[];
  readonly isAdmin: boolean;
  readonly task: ProjectTask;
  readonly viewerId: string | null;
}) => {
  const [versionState, setVersionState] = useState({
    sourceVersion: task.version,
    value: task.version,
  });
  const version =
    versionState.sourceVersion === task.version
      ? versionState.value
      : task.version;
  const editable =
    isAdmin ||
    task.createdById === viewerId ||
    (viewerId !== null && task.assigneeIds.includes(viewerId));

  return (
    <TaskDetailsPanel
      currentUserId={viewerId}
      editable={editable}
      employees={employees}
      isAdmin={isAdmin}
      onVersionChange={(value) =>
        setVersionState({ sourceVersion: task.version, value })
      }
      projectId={task.projectId}
      taskId={task.id}
      taskTitle={task.title}
      trigger={
        <WorkspaceButton
          aria-label={`Open details for ${task.title}`}
          className="member-profile-task-title"
          type="button"
          variant="ghost"
        >
          {task.title}
        </WorkspaceButton>
      }
      version={version}
    />
  );
};
