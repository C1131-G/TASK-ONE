import { randomUUID } from "node:crypto";

import { entry } from "./action-permissions-shared";
import type { ActionEntry } from "./action-permissions-shared";
import { ids, nextKey } from "./support/action-harness";

const tasks = await import("../../features/tasks/tasks-actions");
const teams = await import("../../features/people/actions/teams");
const uploads = await import("../../features/files/files-actions");
const peopleQueries = await import("../../features/people/people-queries");
const filesQueries = await import("../../features/files/files-queries");

export const actionCatalog3: readonly ActionEntry[] = [
  entry("changeTaskColumnAction", tasks.changeTaskColumnAction, () => ({
    expectedVersion: 1,
    idempotencyKey: nextKey(),
    status: "progress",
    taskId: ids.taskId,
  })),
  entry("setTaskRecurrenceAction", tasks.setTaskRecurrenceAction, () => ({
    expectedVersion: 1,
    idempotencyKey: nextKey(),
    recurrence: null,
    taskId: ids.taskId,
  })),
  entry("moveTaskAction", tasks.moveTaskAction, () => ({
    destinationProjectId: ids.archivedProjectId,
    expectedVersion: 1,
    idempotencyKey: nextKey(),
    taskId: ids.taskId,
  })),
  entry("duplicateTaskAction", tasks.duplicateTaskAction, () => ({
    expectedVersion: 1,
    idempotencyKey: nextKey(),
    taskId: ids.taskId,
  })),
  entry("archiveTaskAction", tasks.archiveTaskAction, () => ({
    expectedVersion: 1,
    idempotencyKey: nextKey(),
    taskId: ids.taskId,
  })),
  entry("restoreTaskAction", tasks.restoreTaskAction, () => ({
    expectedVersion: 1,
    idempotencyKey: nextKey(),
    taskId: ids.archivedTaskId,
  })),
  entry("undoTaskArchiveAction", tasks.undoTaskArchiveAction, () => ({
    idempotencyKey: nextKey(),
    undoId: ids.random,
  })),
  entry("undoTaskCompletionAction", tasks.undoTaskCompletionAction, () => ({
    idempotencyKey: nextKey(),
    undoId: ids.random,
  })),
  entry("bulkUpdateTasksAction", tasks.bulkUpdateTasksAction, () => ({
    changes: {
      assigneeIds: [],
      dueDate: null,
      priority: "medium",
      status: "todo",
    },
    idempotencyKey: nextKey(),
    targets: [{ expectedVersion: 1, taskId: ids.taskId }],
  })),
  entry("setTaskRelationsAction", tasks.setTaskRelationsAction, () => ({
    dependencyTaskIds: [],
    expectedVersion: 1,
    idempotencyKey: nextKey(),
    labelIds: [],
    taskId: ids.taskId,
  })),
  entry("reorderTasksAction", tasks.reorderTasksAction, () => ({
    changes: [{ expectedVersion: 1, position: 0, taskId: ids.taskId }],
    idempotencyKey: nextKey(),
  })),
  entry("listTeams", peopleQueries.listTeams, () => ({})),
  entry("createTeamAction", teams.createTeamAction, () => ({
    color: "#2563eb",
    description: null,
    idempotencyKey: nextKey(),
    name: `Team ${randomUUID().slice(0, 8)}`,
  })),
  entry("updateTeamAction", teams.updateTeamAction, () => ({
    idempotencyKey: nextKey(),
    team: { color: "#2563eb", description: null, name: "Renamed team" },
    teamId: ids.random,
  })),
  entry("deleteTeamAction", teams.deleteTeamAction, () => ({
    idempotencyKey: nextKey(),
    teamId: ids.random,
  })),
  entry("requestTaskUploadAction", uploads.requestTaskUploadAction, () => ({
    contentType: "application/pdf",
    fileName: "a.pdf",
    sizeBytes: 10,
    taskId: ids.taskId,
  })),
  entry(
    "requestProjectUploadAction",
    uploads.requestProjectUploadAction,
    () => ({
      contentType: "application/pdf",
      fileName: "a.pdf",
      projectId: ids.projectId,
      sizeBytes: 10,
    })
  ),
  entry("listProjectFilesAction", uploads.listProjectFilesAction, () => ({
    projectId: ids.projectId,
  })),
  entry("listProjectFiles", filesQueries.listProjectFiles, () => ({
    projectId: ids.projectId,
  })),
  entry("getAvatarDownloadUrl", filesQueries.getAvatarDownloadUrl, () => ({
    userId: ids.employeeId,
  })),
  entry("listTaskFilesAction", uploads.listTaskFilesAction, () => ({
    taskId: ids.taskId,
  })),
  entry("requestAvatarUploadAction", uploads.requestAvatarUploadAction, () => ({
    contentType: "image/png",
    sizeBytes: 10,
  })),
  entry(
    "finalizeAvatarUploadAction",
    uploads.finalizeAvatarUploadAction,
    () => ({
      idempotencyKey: nextKey(),
      uploadIntentId: ids.random,
    })
  ),
  entry(
    "getAvatarDownloadUrlAction",
    uploads.getAvatarDownloadUrlAction,
    () => ({
      userId: ids.employeeId,
    })
  ),
  entry("finalizeUploadAction", uploads.finalizeUploadAction, () => ({
    idempotencyKey: nextKey(),
    uploadIntentId: ids.random,
  })),
  entry("getFileDownloadUrlAction", uploads.getFileDownloadUrlAction, () => ({
    fileId: ids.fileId,
  })),
  entry("getFilePreviewUrlAction", uploads.getFilePreviewUrlAction, () => ({
    fileId: ids.fileId,
  })),
  entry("renameFileAction", uploads.renameFileAction, () => ({
    fileId: ids.fileId,
    fileName: "renamed.txt",
    idempotencyKey: nextKey(),
  })),
  entry("duplicateFileAction", uploads.duplicateFileAction, () => ({
    fileId: ids.fileId,
    idempotencyKey: nextKey(),
  })),
  entry("removeFileAction", uploads.removeFileAction, () => ({
    fileId: ids.fileId,
    idempotencyKey: nextKey(),
  })),
  entry("undoFileRemovalAction", uploads.undoFileRemovalAction, () => ({
    idempotencyKey: nextKey(),
    undoId: ids.random,
  })),
];
