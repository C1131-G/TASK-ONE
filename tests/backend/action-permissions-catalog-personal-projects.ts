import { randomUUID } from "node:crypto";

import {
  entry,
  view,
  subtaskBody,
  taskBody,
} from "./action-permissions-shared";
import type { ActionEntry } from "./action-permissions-shared";
import { ids, nextKey } from "./support/action-harness";

const personalPreferences =
  await import("../../features/user/actions/user-personal-preferences");
const notifications =
  await import("../../features/notifications/notifications-actions");
const password = await import("../../features/user/actions/user-password");
const projects = await import("../../features/projects/projects-actions");
const savedViews =
  await import("../../features/projects/actions/projects-saved-views");
const sessions = await import("../../features/user/actions/user-sessions");
const subtasks = await import("../../features/tasks/actions/tasks-subtasks");
const tasks = await import("../../features/tasks/tasks-actions");
const projectsQueries =
  await import("../../features/projects/projects-queries");
const userQueries = await import("../../features/user/user-queries");
const tasksQueries = await import("../../features/tasks/tasks-queries");

export const personalProjectActionCatalog: readonly ActionEntry[] = [
  entry(
    "markAllNotificationsReadAction",
    notifications.markAllNotificationsReadAction,
    () => ({ idempotencyKey: nextKey() })
  ),
  entry(
    "setNotificationPreferenceAction",
    notifications.setNotificationPreferenceAction,
    () => ({
      channel: "in-app",
      enabled: true,
      eventType: "mention",
      idempotencyKey: nextKey(),
    })
  ),
  entry(
    "registerPushSubscriptionAction",
    notifications.registerPushSubscriptionAction,
    () => ({
      endpoint: `https://fcm.googleapis.com/${randomUUID()}`,
      idempotencyKey: nextKey(),
      keys: { auth: "auth-key-123456", p256dh: "public-key-1234567890" },
      userAgent: null,
    })
  ),
  entry(
    "removePushSubscriptionAction",
    notifications.removePushSubscriptionAction,
    () => ({
      endpoint: "https://fcm.googleapis.com/x",
      idempotencyKey: nextKey(),
    })
  ),
  entry(
    "changeOwnPasswordAction",
    password.changeOwnPasswordAction,
    () => ({
      currentPassword: "not-the-password",
      newPassword: "another-secret-9!",
    }),
    true
  ),
  entry(
    "getPersonalPreferences",
    userQueries.getPersonalPreferences,
    () => ({})
  ),
  entry(
    "savePersonalPreferencesAction",
    personalPreferences.savePersonalPreferencesAction,
    () => ({ idempotencyKey: nextKey(), preferences: {} })
  ),
  entry(
    "saveTaskTableColumnWidthsAction",
    personalPreferences.saveTaskTableColumnWidthsAction,
    () => ({ columnWidths: { due: 140 }, idempotencyKey: nextKey() })
  ),
  entry("listProjects", projectsQueries.listProjects, () => ({})),
  entry("listProjectMilestones", projectsQueries.listProjectMilestones, () => ({
    projectId: ids.projectId,
  })),
  entry("createProjectAction", projects.createProjectAction, () => ({
    description: null,
    idempotencyKey: nextKey(),
    key: `K${randomUUID().replaceAll("-", "").slice(0, 6)}`.toUpperCase(),
    name: "Permission project",
    status: "planning",
  })),
  entry("duplicateProjectAction", projects.duplicateProjectAction, () => ({
    idempotencyKey: nextKey(),
    key: `D${randomUUID().replaceAll("-", "").slice(0, 6)}`.toUpperCase(),
    name: "Copy",
    sourceProjectId: ids.projectId,
  })),
  entry("updateProjectAction", projects.updateProjectAction, () => ({
    description: null,
    expectedVersion: 1,
    idempotencyKey: nextKey(),
    name: "Renamed",
    projectId: ids.projectId,
    status: "planning",
  })),
  entry("archiveProjectAction", projects.archiveProjectAction, () => ({
    expectedVersion: 1,
    idempotencyKey: nextKey(),
    projectId: ids.projectId,
  })),
  entry("restoreProjectAction", projects.restoreProjectAction, () => ({
    expectedVersion: 1,
    idempotencyKey: nextKey(),
    projectId: ids.archivedProjectId,
  })),
  entry("setProjectPeopleAction", projects.setProjectPeopleAction, () => ({
    expectedVersion: 1,
    idempotencyKey: nextKey(),
    leadId: null,
    memberIds: [],
    projectId: ids.projectId,
  })),
  entry(
    "saveProjectMilestonesAction",
    projects.saveProjectMilestonesAction,
    () => ({
      expectedVersion: 1,
      idempotencyKey: nextKey(),
      milestones: [],
      projectId: ids.projectId,
    })
  ),
  entry("listSavedViews", projectsQueries.listSavedViews, () => ({})),
  entry("createSavedViewAction", savedViews.createSavedViewAction, () => ({
    idempotencyKey: nextKey(),
    view: view(),
  })),
  entry("updateSavedViewAction", savedViews.updateSavedViewAction, () => ({
    idempotencyKey: nextKey(),
    view: view(),
    viewId: ids.random,
  })),
  entry("deleteSavedViewAction", savedViews.deleteSavedViewAction, () => ({
    idempotencyKey: nextKey(),
    viewId: ids.random,
  })),
  entry("listMySessions", userQueries.listMySessions, () => ({}), true),
  entry("listEmployeeSessions", userQueries.listEmployeeSessions, () => ({
    employeeId: ids.employeeId,
  })),
  entry(
    "revokeSessionAction",
    sessions.revokeSessionAction,
    () => ({ sessionId: "not-a-real-session" }),
    true
  ),
  entry("listTaskSubtasksAction", subtasks.listTaskSubtasksAction, () => ({
    taskId: ids.taskId,
  })),
  entry("reorderSubtasksAction", subtasks.reorderSubtasksAction, () => ({
    expectedTaskVersion: 1,
    idempotencyKey: nextKey(),
    subtaskIds: [],
    taskId: ids.taskId,
  })),
  entry("createSubtaskAction", subtasks.createSubtaskAction, () => ({
    ...subtaskBody(),
    taskId: ids.taskId,
  })),
  entry("updateSubtaskAction", subtasks.updateSubtaskAction, () => ({
    ...subtaskBody(),
    completed: false,
    subtaskId: ids.random,
  })),
  entry("removeSubtaskAction", subtasks.removeSubtaskAction, () => ({
    expectedTaskVersion: 1,
    idempotencyKey: nextKey(),
    subtaskId: ids.random,
  })),
  entry("promoteSubtaskAction", subtasks.promoteSubtaskAction, () => ({
    expectedTaskVersion: 1,
    idempotencyKey: nextKey(),
    subtaskId: ids.random,
  })),
  entry("getProjectTaskAction", tasks.getProjectTaskAction, () => ({
    projectId: ids.projectId,
    taskId: ids.taskId,
  })),
  entry("listProjectTasksAction", tasks.listProjectTasksAction, () => ({
    limit: 10,
    offset: 0,
    projectId: ids.projectId,
  })),
  entry("getProjectTask", tasksQueries.getProjectTask, () => ({
    projectId: ids.projectId,
    taskId: ids.taskId,
  })),
  entry("listProjectTasks", tasksQueries.listProjectTasks, () => ({
    limit: 10,
    offset: 0,
    projectId: ids.projectId,
  })),
  entry("createTaskAction", tasks.createTaskAction, () => ({
    ...taskBody(),
    idempotencyKey: nextKey(),
    projectId: ids.projectId,
  })),
  entry("rescheduleTaskAction", tasks.rescheduleTaskAction, () => ({
    dueDate: "2026-03-20",
    expectedVersion: 1,
    idempotencyKey: nextKey(),
    startDate: "2026-03-10",
    taskId: ids.taskId,
  })),
  entry("updateTaskAction", tasks.updateTaskAction, () => ({
    ...taskBody(),
    expectedVersion: 1,
    idempotencyKey: nextKey(),
    status: "todo",
    taskId: ids.taskId,
  })),
];
