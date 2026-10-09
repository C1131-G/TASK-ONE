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
  await import("../../app/actions/personal-preferences");
const notifications = await import("../../app/actions/notifications");
const password = await import("../../app/actions/password");
const projects = await import("../../app/actions/projects");
const savedViews = await import("../../app/actions/saved-views");
const sessions = await import("../../app/actions/sessions");
const subtasks = await import("../../app/actions/subtasks");
const tasks = await import("../../app/actions/tasks");

export const actionCatalog2: readonly ActionEntry[] = [
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
    "getPersonalPreferencesAction",
    personalPreferences.getPersonalPreferencesAction,
    () => ({})
  ),
  entry(
    "savePersonalPreferencesAction",
    personalPreferences.savePersonalPreferencesAction,
    () => ({ idempotencyKey: nextKey(), preferences: {} })
  ),
  entry("listProjectsAction", projects.listProjectsAction, () => ({})),
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
  entry("listSavedViewsAction", savedViews.listSavedViewsAction, () => ({})),
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
  entry(
    "listMySessionsAction",
    sessions.listMySessionsAction,
    () => ({}),
    true
  ),
  entry(
    "listEmployeeSessionsAction",
    sessions.listEmployeeSessionsAction,
    () => ({
      employeeId: ids.employeeId,
    })
  ),
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
  entry("listProjectTasksAction", tasks.listProjectTasksAction, () => ({
    limit: 10,
    offset: 0,
    projectId: ids.projectId,
  })),
  entry("createTaskAction", tasks.createTaskAction, () => ({
    ...taskBody(),
    idempotencyKey: nextKey(),
    projectId: ids.projectId,
  })),
  entry("updateTaskAction", tasks.updateTaskAction, () => ({
    ...taskBody(),
    expectedVersion: 1,
    idempotencyKey: nextKey(),
    status: "todo",
    taskId: ids.taskId,
  })),
];
