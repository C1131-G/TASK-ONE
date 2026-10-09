import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import {
  callAs,
  ids,
  nextKey,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import type {
  ActionFunction,
  ActionResultLike,
  Persona,
} from "./support/action-harness";

const calendar = await import("../../app/actions/calendar");
const comments = await import("../../app/actions/comments");
const companySettings = await import("../../app/actions/company-settings");
const dashboard = await import("../../app/actions/dashboard");
const discovery = await import("../../app/actions/discovery");
const employees = await import("../../app/actions/employees");
const jobs = await import("../../app/actions/jobs");
const labels = await import("../../app/actions/labels");
const notifications = await import("../../app/actions/notifications");
const password = await import("../../app/actions/password");
const personalPreferences =
  await import("../../app/actions/personal-preferences");
const projects = await import("../../app/actions/projects");
const savedViews = await import("../../app/actions/saved-views");
const sessions = await import("../../app/actions/sessions");
const subtasks = await import("../../app/actions/subtasks");
const tasks = await import("../../app/actions/tasks");
const teams = await import("../../app/actions/teams");
const uploads = await import("../../app/actions/uploads");

beforeAll(setupHarness);
afterAll(teardownHarness);

interface ActionEntry {
  readonly action: ActionFunction;
  readonly authOnly?: boolean;
  readonly input: () => unknown;
  readonly name: string;
}

const entry = (
  name: string,
  action: (input: unknown) => Promise<unknown>,
  input: () => unknown,
  authOnly = false
): ActionEntry => ({
  action: action as ActionFunction,
  authOnly,
  input,
  name,
});

const view = () => ({
  filters: {},
  groupBy: null,
  hiddenColumns: [],
  isShared: false,
  name: "Permission view",
  projectId: null,
  sort: [],
  type: "list",
});

const eventBody = () => ({
  attendeeIds: [],
  description: null,
  endsAt: null,
  location: null,
  projectId: null,
  startsAt: "2026-01-01T00:00:00.000Z",
  title: "Permission event",
});

const subtaskBody = () => ({
  assigneeId: null,
  description: null,
  dueDate: null,
  expectedTaskVersion: 1,
  idempotencyKey: nextKey(),
  title: "Permission subtask",
});

const taskBody = () => ({
  assigneeIds: [],
  description: null,
  dueDate: null,
  priority: "medium",
  title: "Permission task",
});

const allActions: readonly ActionEntry[] = [
  entry("listCalendarEventsAction", calendar.listCalendarEventsAction, () => ({
    from: "2026-01-01T00:00:00.000Z",
    to: "2026-02-01T00:00:00.000Z",
  })),
  entry(
    "createCalendarEventAction",
    calendar.createCalendarEventAction,
    () => ({
      ...eventBody(),
      idempotencyKey: nextKey(),
    })
  ),
  entry(
    "updateCalendarEventAction",
    calendar.updateCalendarEventAction,
    () => ({
      ...eventBody(),
      eventId: ids.random,
      idempotencyKey: nextKey(),
    })
  ),
  entry(
    "deleteCalendarEventAction",
    calendar.deleteCalendarEventAction,
    () => ({
      eventId: ids.random,
      idempotencyKey: nextKey(),
    })
  ),
  entry("listTaskCommentsAction", comments.listTaskCommentsAction, () => ({
    taskId: ids.taskId,
  })),
  entry("createCommentAction", comments.createCommentAction, () => ({
    body: "Permission comment",
    idempotencyKey: nextKey(),
    taskId: ids.taskId,
  })),
  entry("removeCommentAction", comments.removeCommentAction, () => ({
    commentId: ids.random,
    idempotencyKey: nextKey(),
  })),
  entry("undoCommentRemovalAction", comments.undoCommentRemovalAction, () => ({
    idempotencyKey: nextKey(),
    undoId: ids.random,
  })),
  entry(
    "toggleCommentReactionAction",
    comments.toggleCommentReactionAction,
    () => ({
      commentId: ids.random,
      emoji: "👍",
      idempotencyKey: nextKey(),
    })
  ),
  entry(
    "getCompanySettingsAction",
    companySettings.getCompanySettingsAction,
    () => ({})
  ),
  entry(
    "updateCompanySettingsAction",
    companySettings.updateCompanySettingsAction,
    () => ({
      brandColor: "#336699",
      brandEnabled: true,
      idempotencyKey: nextKey(),
      name: "Permission Co",
      slug: "permission-co",
      timeZone: "Asia/Kolkata",
    })
  ),
  entry(
    "getDashboardOverviewAction",
    dashboard.getDashboardOverviewAction,
    () => ({})
  ),
  entry(
    "getPersonalWorkspaceAction",
    discovery.getPersonalWorkspaceAction,
    () => ({})
  ),
  entry(
    "toggleProjectFavoriteAction",
    discovery.toggleProjectFavoriteAction,
    () => ({
      idempotencyKey: nextKey(),
      projectId: ids.projectId,
    })
  ),
  entry("toggleTaskFavoriteAction", discovery.toggleTaskFavoriteAction, () => ({
    idempotencyKey: nextKey(),
    taskId: ids.taskId,
  })),
  entry("searchWorkspaceAction", discovery.searchWorkspaceAction, () => ({
    query: "permission",
  })),
  entry("listEmployeesAction", employees.listEmployeesAction, () => ({
    search: "",
  })),
  entry("createEmployeeAction", employees.createEmployeeAction, () => ({
    email: `new-${randomUUID()}@permissions.example`,
    jobTitle: null,
    name: "New Person",
    role: "employee",
    teamId: null,
  })),
  entry("deactivateEmployeeAction", employees.deactivateEmployeeAction, () => ({
    employeeId: ids.random,
    idempotencyKey: nextKey(),
  })),
  entry("reactivateEmployeeAction", employees.reactivateEmployeeAction, () => ({
    employeeId: ids.random,
    idempotencyKey: nextKey(),
  })),
  entry("changeEmployeeRoleAction", employees.changeEmployeeRoleAction, () => ({
    employeeId: ids.random,
    idempotencyKey: nextKey(),
    role: "employee",
  })),
  entry(
    "resetEmployeePasswordAction",
    employees.resetEmployeePasswordAction,
    () => ({ employeeId: ids.random })
  ),
  entry(
    "updateEmployeeDetailsAction",
    employees.updateEmployeeDetailsAction,
    () => ({
      email: `detail-${randomUUID()}@permissions.example`,
      employeeId: ids.random,
      idempotencyKey: nextKey(),
      jobTitle: null,
      teamId: null,
    })
  ),
  entry("updateOwnProfileAction", employees.updateOwnProfileAction, () => ({
    idempotencyKey: nextKey(),
    name: "Permission Name",
  })),
  entry("listDeadJobsAction", jobs.listDeadJobsAction, () => ({ limit: 5 })),
  entry("listLabelsAction", labels.listLabelsAction, () => ({})),
  entry("createLabelAction", labels.createLabelAction, () => ({
    color: "#16a34a",
    idempotencyKey: nextKey(),
    name: `perm-${randomUUID().slice(0, 8)}`,
  })),
  entry("updateLabelAction", labels.updateLabelAction, () => ({
    idempotencyKey: nextKey(),
    label: { color: "#16a34a", name: "renamed" },
    labelId: ids.random,
  })),
  entry("removeLabelAction", labels.removeLabelAction, () => ({
    idempotencyKey: nextKey(),
    labelId: ids.random,
  })),
  entry(
    "markNotificationReadAction",
    notifications.markNotificationReadAction,
    () => ({
      idempotencyKey: nextKey(),
      notificationId: ids.random,
    })
  ),
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
  entry("listTeamsAction", teams.listTeamsAction, () => ({})),
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

// Actions that require an administrator. An ordinary employee must be refused
// even though the request is otherwise well formed.
const adminOnlyNames: readonly string[] = [
  "createCalendarEventAction",
  "updateCalendarEventAction",
  "deleteCalendarEventAction",
  "updateCompanySettingsAction",
  "createEmployeeAction",
  "deactivateEmployeeAction",
  "reactivateEmployeeAction",
  "changeEmployeeRoleAction",
  "resetEmployeePasswordAction",
  "updateEmployeeDetailsAction",
  "listDeadJobsAction",
  "createLabelAction",
  "updateLabelAction",
  "removeLabelAction",
  "createProjectAction",
  "duplicateProjectAction",
  "updateProjectAction",
  "archiveProjectAction",
  "restoreProjectAction",
  "setProjectPeopleAction",
  "saveProjectMilestonesAction",
  "listEmployeeSessionsAction",
  "archiveTaskAction",
  "restoreTaskAction",
  "undoTaskArchiveAction",
  "createTeamAction",
  "updateTeamAction",
  "deleteTeamAction",
  "requestProjectUploadAction",
  "listProjectFilesAction",
];

const collectViolations = async (
  persona: Persona,
  entries: readonly ActionEntry[],
  allowed: (result: ActionResultLike) => boolean
): Promise<string[]> => {
  const violations: string[] = [];
  for (const { action, input, name } of entries) {
    // Each call must run in order because they share the mocked request headers.
    // eslint-disable-next-line no-await-in-loop
    const result = await callAs(persona, action, input());
    if (!allowed(result)) {
      violations.push(
        `${name}: ${result.ok ? "succeeded" : `${result.error?.code} (${result.error?.message})`}`
      );
    }
  }
  return violations;
};

const rejectedWith =
  (...codes: string[]) =>
  (result: ActionResultLike): boolean =>
    !result.ok && codes.includes(result.error?.code ?? "");

it("covers every Server Action exported by the adapters", () => {
  const exported = new Set<string>();
  for (const actionModule of [
    calendar,
    comments,
    companySettings,
    dashboard,
    discovery,
    employees,
    jobs,
    labels,
    notifications,
    password,
    personalPreferences,
    projects,
    savedViews,
    sessions,
    subtasks,
    tasks,
    teams,
    uploads,
  ]) {
    for (const name of Object.keys(actionModule)) {
      exported.add(name);
    }
  }
  const covered = new Set(allActions.map(({ name }) => name));
  // Reads with their own dedicated shape of input are listed explicitly.
  const missing = [...exported].filter((name) => !covered.has(name));
  expect(missing).toEqual([]);
});

it("rejects anonymous requests on every action", async () => {
  const violations = await collectViolations(
    "anonymous",
    allActions,
    rejectedWith("UNAUTHENTICATED")
  );
  expect(violations).toEqual([]);
});

it("rejects deactivated accounts on every action", async () => {
  const violations = await collectViolations(
    "deactivated",
    allActions,
    rejectedWith("UNAUTHENTICATED")
  );
  expect(violations).toEqual([]);
});

it("blocks accounts that must change their password from every workspace action", async () => {
  const workspaceActions = allActions.filter(({ authOnly }) => !authOnly);
  const violations = await collectViolations(
    "forced",
    workspaceActions,
    rejectedWith("FORBIDDEN")
  );
  expect(violations).toEqual([]);
});

it("lets accounts that must change their password reach the onboarding actions only", async () => {
  const sessionList = await callAs("forced", sessions.listMySessionsAction, {});
  expect(sessionList.ok).toBe(true);
  const wrongPassword = await callAs(
    "forced",
    password.changeOwnPasswordAction,
    { currentPassword: "not-the-password", newPassword: "another-secret-9!" }
  );
  // The request reaches the password check instead of the onboarding gate.
  expect(wrongPassword.ok).toBe(false);
  expect(wrongPassword.error?.message ?? "").not.toContain(
    "Change your password before continuing."
  );
});

it("refuses administrator-only actions for an ordinary employee", async () => {
  const adminEntries = allActions.filter(({ name }) =>
    adminOnlyNames.includes(name)
  );
  expect(adminEntries).toHaveLength(adminOnlyNames.length);
  const violations = await collectViolations(
    "owner",
    adminEntries,
    rejectedWith("FORBIDDEN")
  );
  expect(violations).toEqual([]);
});

it("refuses task, subtask, and file edits from an employee who neither owns nor is assigned the work", async () => {
  const names = [
    "updateTaskAction",
    "changeTaskColumnAction",
    "setTaskRecurrenceAction",
    "moveTaskAction",
    "duplicateTaskAction",
    "bulkUpdateTasksAction",
    "setTaskRelationsAction",
    "reorderTasksAction",
    "createSubtaskAction",
    "renameFileAction",
    "removeFileAction",
    "duplicateFileAction",
  ];
  const guarded = allActions.filter(({ name }) => names.includes(name));
  expect(guarded).toHaveLength(names.length);
  const violations = await collectViolations(
    "outsider",
    guarded,
    rejectedWith("FORBIDDEN", "NOT_FOUND")
  );
  expect(violations).toEqual([]);
});

it("lets the owner of a task through the same edit actions the outsider was refused", async () => {
  const update = await callAs("owner", tasks.updateTaskAction, {
    ...taskBody(),
    expectedVersion: 1,
    idempotencyKey: nextKey(),
    status: "todo",
    taskId: ids.taskId,
  });
  expect(update).toMatchObject({ ok: true });
});

it("enforces ownership on comments and subtasks created by someone else", async () => {
  const comment = await callAs("owner", comments.createCommentAction, {
    body: "Owner comment",
    idempotencyKey: nextKey(),
    taskId: ids.taskId,
  });
  expect(comment.ok).toBe(true);
  const commentId = (comment as unknown as { data: { id: string } }).data.id;
  const removeByOutsider = await callAs(
    "outsider",
    comments.removeCommentAction,
    {
      commentId,
      idempotencyKey: nextKey(),
    }
  );
  expect(removeByOutsider).toMatchObject({
    error: { code: expect.stringMatching(/FORBIDDEN|NOT_FOUND/u) },
    ok: false,
  });

  const subtask = await callAs("owner", subtasks.createSubtaskAction, {
    ...subtaskBody(),
    expectedTaskVersion: 2,
    taskId: ids.taskId,
  });
  expect(subtask.ok).toBe(true);
  const created = (
    subtask as unknown as {
      data: { parentVersion: number; subtask: { id: string } };
    }
  ).data;
  for (const [action, extra] of [
    [subtasks.updateSubtaskAction, { completed: false, title: "Hijacked" }],
    [subtasks.removeSubtaskAction, {}],
    [subtasks.promoteSubtaskAction, {}],
  ] as const) {
    // Sequential on purpose: the persona headers are shared.
    // eslint-disable-next-line no-await-in-loop
    const result = await callAs("outsider", action as ActionFunction, {
      assigneeId: null,
      description: null,
      dueDate: null,
      expectedTaskVersion: created.parentVersion,
      idempotencyKey: nextKey(),
      subtaskId: created.subtask.id,
      title: "Hijacked",
      ...extra,
    });
    expect(result).toMatchObject({
      error: { code: expect.stringMatching(/FORBIDDEN|NOT_FOUND/u) },
      ok: false,
    });
  }
});

it("refuses edits to archived work even for the owner and for administrators", async () => {
  const archivedTaskEdit = await callAs("owner", tasks.updateTaskAction, {
    ...taskBody(),
    expectedVersion: 1,
    idempotencyKey: nextKey(),
    status: "todo",
    taskId: ids.archivedTaskId,
  });
  expect(archivedTaskEdit).toMatchObject({
    error: { code: "FORBIDDEN" },
    ok: false,
  });

  const archivedTaskByAdmin = await callAs("admin", tasks.updateTaskAction, {
    ...taskBody(),
    expectedVersion: 1,
    idempotencyKey: nextKey(),
    status: "todo",
    taskId: ids.archivedTaskId,
  });
  expect(archivedTaskByAdmin).toMatchObject({ ok: false });

  const taskInArchivedProject = await callAs("owner", tasks.createTaskAction, {
    ...taskBody(),
    idempotencyKey: nextKey(),
    projectId: ids.archivedProjectId,
  });
  expect(taskInArchivedProject).toMatchObject({ ok: false });

  const archivedProjectEdit = await callAs(
    "admin",
    projects.updateProjectAction,
    {
      description: null,
      expectedVersion: 1,
      idempotencyKey: nextKey(),
      name: "Should not change",
      projectId: ids.archivedProjectId,
      status: "planning",
    }
  );
  expect(archivedProjectEdit).toMatchObject({
    error: { code: "FORBIDDEN" },
    ok: false,
  });

  const moveIntoArchivedProject = await callAs("owner", tasks.moveTaskAction, {
    destinationProjectId: ids.archivedProjectId,
    expectedVersion: 1,
    idempotencyKey: nextKey(),
    taskId: ids.taskId,
  });
  expect(moveIntoArchivedProject).toMatchObject({ ok: false });
});
