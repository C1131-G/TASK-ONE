import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import {
  authPool,
  callAs,
  EMAIL_DOMAIN,
  ids,
  nextKey,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import type { ActionFunction, Persona } from "./support/action-harness";

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
const { Idempotency, IdempotencyLive } =
  await import("../../src/server/core/idempotency");
const { Storage } = await import("../../src/server/storage/storage");
const { AvatarUploadResultSchema, FinalizedFileSchema, Uploads, UploadsLive } =
  await import("../../src/server/storage/uploads");

beforeAll(setupHarness);
afterAll(teardownHarness);

const covered = new Set<string>();

const unique = (): string => randomUUID().replaceAll("-", "").slice(0, 8);
const projectKey = (): string => `R${unique().slice(0, 6)}`.toUpperCase();

/**
 * Runs an action twice with the same idempotency key and checks that the
 * second call replays the first result exactly instead of acting again.
 */
const replay = async <Data>(
  name: string,
  persona: Persona,
  action: unknown,
  input: Record<string, unknown>
): Promise<Data> => {
  const idempotencyKey = nextKey();
  const run = () =>
    callAs(persona, action as ActionFunction, { ...input, idempotencyKey });
  const first = await run();
  if (!first.ok) {
    throw new Error(
      `${name} failed on the first call: ${first.error?.code} ${first.error?.message}`
    );
  }
  const second = await run();
  if (!second.ok) {
    throw new Error(
      `${name} failed on the replay: ${second.error?.code} ${second.error?.message}`
    );
  }
  expect(JSON.stringify(second.data), `${name} replay result`).toBe(
    JSON.stringify(first.data)
  );
  covered.add(name);
  return first.data as Data;
};

const taskVersion = async (taskId: string): Promise<number> => {
  const rows = await authPool.query("SELECT version FROM task WHERE id = $1", [
    taskId,
  ]);
  return rows.rows[0]?.version;
};

interface Versioned {
  readonly id: string;
  readonly version: number;
}
interface VersionOnly {
  readonly version: number;
}
interface SubtaskResult {
  readonly parentVersion: number;
  readonly subtask: { readonly id: string };
}

const state: {
  copyProjectId: string;
  projectId: string;
  taskId: string;
} = { copyProjectId: "", projectId: "", taskId: "" };

it("replays every project mutation", async () => {
  const created = await replay<Versioned>(
    "createProjectAction",
    "admin",
    projects.createProjectAction,
    {
      description: null,
      key: projectKey(),
      name: "Replay project",
      status: "planning",
    }
  );
  state.projectId = created.id;
  const updated = await replay<Versioned>(
    "updateProjectAction",
    "admin",
    projects.updateProjectAction,
    {
      description: null,
      expectedVersion: created.version,
      name: "Replay project renamed",
      projectId: created.id,
      status: "active",
    }
  );
  const people = await replay<Versioned>(
    "setProjectPeopleAction",
    "admin",
    projects.setProjectPeopleAction,
    {
      expectedVersion: updated.version,
      leadId: personaId("owner"),
      memberIds: [personaId("owner")],
      projectId: created.id,
    }
  );
  await replay<VersionOnly>(
    "saveProjectMilestonesAction",
    "admin",
    projects.saveProjectMilestonesAction,
    {
      expectedVersion: people.version,
      milestones: [
        { completed: false, dueDate: null, id: null, name: "Kickoff" },
      ],
      projectId: created.id,
    }
  );
  const copy = await replay<Versioned>(
    "duplicateProjectAction",
    "admin",
    projects.duplicateProjectAction,
    {
      key: projectKey(),
      name: "Replay copy",
      sourceProjectId: created.id,
    }
  );
  state.copyProjectId = copy.id;
  const archived = await replay<Versioned>(
    "archiveProjectAction",
    "admin",
    projects.archiveProjectAction,
    { expectedVersion: copy.version, projectId: copy.id }
  );
  await replay<Versioned>(
    "restoreProjectAction",
    "admin",
    projects.restoreProjectAction,
    { expectedVersion: archived.version, projectId: copy.id }
  );
});

it("replays team, label, calendar, and company-settings mutations", async () => {
  const team = await replay<{ id: string }>(
    "createTeamAction",
    "admin",
    teams.createTeamAction,
    {
      color: "#2563eb",
      description: null,
      name: `Replay team ${unique()}`,
    }
  );
  await replay("updateTeamAction", "admin", teams.updateTeamAction, {
    team: {
      color: "#16a34a",
      description: null,
      name: `Replay team ${unique()}`,
    },
    teamId: team.id,
  });
  await replay("deleteTeamAction", "admin", teams.deleteTeamAction, {
    teamId: team.id,
  });

  const label = await replay<{ id: string }>(
    "createLabelAction",
    "admin",
    labels.createLabelAction,
    { color: "#16a34a", name: `replay-${unique()}` }
  );
  await replay("updateLabelAction", "admin", labels.updateLabelAction, {
    label: { color: "#2563eb", name: `replay-${unique()}` },
    labelId: label.id,
  });
  await replay("removeLabelAction", "admin", labels.removeLabelAction, {
    labelId: label.id,
  });

  const eventBody = {
    attendeeIds: [],
    description: null,
    endsAt: null,
    location: null,
    projectId: null,
    startsAt: "2026-12-01T09:00:00.000Z",
    title: "Replay event",
  };
  const event = await replay<{ id: string }>(
    "createCalendarEventAction",
    "admin",
    calendar.createCalendarEventAction,
    eventBody
  );
  await replay(
    "updateCalendarEventAction",
    "admin",
    calendar.updateCalendarEventAction,
    { ...eventBody, eventId: event.id, title: "Replay event renamed" }
  );
  await replay(
    "deleteCalendarEventAction",
    "admin",
    calendar.deleteCalendarEventAction,
    { eventId: event.id }
  );

  const current = await callAs(
    "admin",
    companySettings.getCompanySettingsAction,
    {}
  );
  const settings = current.data as {
    brandColor: string;
    brandEnabled: boolean;
    name: string;
    slug: string;
    timeZone: string;
  };
  await replay(
    "updateCompanySettingsAction",
    "admin",
    companySettings.updateCompanySettingsAction,
    {
      brandColor: settings.brandColor,
      brandEnabled: settings.brandEnabled,
      name: settings.name,
      slug: settings.slug,
      timeZone: settings.timeZone,
    }
  );
});

it("replays every employee mutation that does not return credentials", async () => {
  const target = personaId("outsider");
  await replay(
    "updateEmployeeDetailsAction",
    "admin",
    employees.updateEmployeeDetailsAction,
    {
      email: `replay-${unique()}@${EMAIL_DOMAIN}`,
      employeeId: target,
      jobTitle: "Replay",
      teamId: null,
    }
  );
  await replay(
    "changeEmployeeRoleAction",
    "admin",
    employees.changeEmployeeRoleAction,
    { employeeId: target, role: "admin" }
  );
  await replay(
    "changeEmployeeRoleAction",
    "admin",
    employees.changeEmployeeRoleAction,
    { employeeId: target, role: "employee" }
  );
  await replay(
    "deactivateEmployeeAction",
    "admin",
    employees.deactivateEmployeeAction,
    { employeeId: target }
  );
  await replay(
    "reactivateEmployeeAction",
    "admin",
    employees.reactivateEmployeeAction,
    { employeeId: target }
  );
  await replay(
    "updateOwnProfileAction",
    "owner",
    employees.updateOwnProfileAction,
    { name: "Replay Owner" }
  );
});

it("replays every task mutation", async () => {
  const task = await replay<Versioned>(
    "createTaskAction",
    "owner",
    tasks.createTaskAction,
    {
      assigneeIds: [],
      description: null,
      dueDate: "2026-12-01",
      priority: "medium",
      projectId: ids.projectId,
      title: "Replay task",
    }
  );
  state.taskId = task.id;
  const updated = await replay<Versioned>(
    "updateTaskAction",
    "owner",
    tasks.updateTaskAction,
    {
      assigneeIds: [],
      description: null,
      dueDate: "2026-12-01",
      expectedVersion: task.version,
      priority: "high",
      status: "todo",
      taskId: task.id,
      title: "Replay task renamed",
    }
  );
  const column = await replay<Versioned>(
    "changeTaskColumnAction",
    "owner",
    tasks.changeTaskColumnAction,
    {
      expectedVersion: updated.version,
      status: "progress",
      taskId: task.id,
    }
  );
  const recurrence = await replay<VersionOnly>(
    "setTaskRecurrenceAction",
    "owner",
    tasks.setTaskRecurrenceAction,
    {
      expectedVersion: column.version,
      recurrence: {
        endsOn: null,
        frequency: "daily",
        interval: 1,
        weekDays: [],
      },
      taskId: task.id,
    }
  );
  const related = await replay<VersionOnly>(
    "setTaskRelationsAction",
    "owner",
    tasks.setTaskRelationsAction,
    {
      dependencyTaskIds: [],
      expectedVersion: recurrence.version,
      labelIds: [],
      taskId: task.id,
    }
  );
  const copy = await replay<Versioned>(
    "duplicateTaskAction",
    "owner",
    tasks.duplicateTaskAction,
    { expectedVersion: related.version, taskId: task.id }
  );
  const bulk = await replay<Versioned[]>(
    "bulkUpdateTasksAction",
    "owner",
    tasks.bulkUpdateTasksAction,
    {
      changes: {
        assigneeIds: [],
        dueDate: null,
        priority: "low",
        status: "todo",
      },
      targets: [{ expectedVersion: copy.version, taskId: copy.id }],
    }
  );
  const ordered = await replay<{ version: number }[]>(
    "reorderTasksAction",
    "owner",
    tasks.reorderTasksAction,
    {
      changes: [
        {
          expectedVersion: bulk[0]?.version ?? 0,
          position: 7,
          taskId: copy.id,
        },
      ],
    }
  );
  await replay<Versioned>("moveTaskAction", "owner", tasks.moveTaskAction, {
    destinationProjectId: state.projectId,
    expectedVersion: ordered[0]?.version ?? 0,
    taskId: copy.id,
  });
});

it("replays every subtask and comment mutation", async () => {
  const subtaskBody = {
    assigneeId: null,
    description: null,
    dueDate: null,
  };
  const first = await replay<SubtaskResult>(
    "createSubtaskAction",
    "owner",
    subtasks.createSubtaskAction,
    {
      ...subtaskBody,
      expectedTaskVersion: await taskVersion(state.taskId),
      taskId: state.taskId,
      title: "Replay subtask one",
    }
  );
  const renamed = await replay<SubtaskResult>(
    "updateSubtaskAction",
    "owner",
    subtasks.updateSubtaskAction,
    {
      ...subtaskBody,
      completed: false,
      expectedTaskVersion: first.parentVersion,
      subtaskId: first.subtask.id,
      title: "Replay subtask one renamed",
    }
  );
  const second = await replay<SubtaskResult>(
    "createSubtaskAction",
    "owner",
    subtasks.createSubtaskAction,
    {
      ...subtaskBody,
      expectedTaskVersion: renamed.parentVersion,
      taskId: state.taskId,
      title: "Replay subtask two",
    }
  );
  await replay("promoteSubtaskAction", "owner", subtasks.promoteSubtaskAction, {
    expectedTaskVersion: second.parentVersion,
    subtaskId: second.subtask.id,
  });
  await replay("removeSubtaskAction", "owner", subtasks.removeSubtaskAction, {
    expectedTaskVersion: await taskVersion(state.taskId),
    subtaskId: first.subtask.id,
  });

  const comment = await replay<{ id: string }>(
    "createCommentAction",
    "owner",
    comments.createCommentAction,
    { body: "Replay comment", taskId: state.taskId }
  );
  await replay(
    "toggleCommentReactionAction",
    "owner",
    comments.toggleCommentReactionAction,
    { commentId: comment.id, emoji: "👍" }
  );
  const removal = await replay<{ undoId: string }>(
    "removeCommentAction",
    "owner",
    comments.removeCommentAction,
    { commentId: comment.id }
  );
  await replay(
    "undoCommentRemovalAction",
    "owner",
    comments.undoCommentRemovalAction,
    { undoId: removal.undoId }
  );
});

it("replays task completion, archive, restore, and both Undo actions", async () => {
  const task = await replay<Versioned>(
    "createTaskAction",
    "owner",
    tasks.createTaskAction,
    {
      assigneeIds: [],
      description: null,
      dueDate: null,
      priority: "medium",
      projectId: ids.projectId,
      title: "Replay completion task",
    }
  );
  const completed = await replay<{
    completionUndo?: { undoId: string };
  }>("updateTaskAction", "owner", tasks.updateTaskAction, {
    assigneeIds: [],
    description: null,
    dueDate: null,
    expectedVersion: task.version,
    priority: "medium",
    status: "done",
    taskId: task.id,
    title: "Replay completion task",
  });
  const { completionUndo } = completed;
  if (!completionUndo) {
    throw new Error("Completing a task should return an Undo receipt.");
  }
  await replay(
    "undoTaskCompletionAction",
    "owner",
    tasks.undoTaskCompletionAction,
    { undoId: completionUndo.undoId }
  );

  const archived = await replay<{ undoId: string }>(
    "archiveTaskAction",
    "admin",
    tasks.archiveTaskAction,
    { expectedVersion: await taskVersion(task.id), taskId: task.id }
  );
  await replay("undoTaskArchiveAction", "admin", tasks.undoTaskArchiveAction, {
    undoId: archived.undoId,
  });
  await replay("archiveTaskAction", "admin", tasks.archiveTaskAction, {
    expectedVersion: await taskVersion(task.id),
    taskId: task.id,
  });
  await replay<Versioned>(
    "restoreTaskAction",
    "admin",
    tasks.restoreTaskAction,
    {
      expectedVersion: await taskVersion(task.id),
      taskId: task.id,
    }
  );
});

it("replays every file mutation that does not return a signed URL", async () => {
  await replay("renameFileAction", "owner", uploads.renameFileAction, {
    fileId: ids.fileId,
    fileName: "replay-renamed.txt",
  });
  await replay("duplicateFileAction", "owner", uploads.duplicateFileAction, {
    fileId: ids.fileId,
  });
  const removal = await replay<{ undoId: string }>(
    "removeFileAction",
    "owner",
    uploads.removeFileAction,
    { fileId: ids.fileId }
  );
  await replay(
    "undoFileRemovalAction",
    "owner",
    uploads.undoFileRemovalAction,
    {
      undoId: removal.undoId,
    }
  );
});

it("replays upload and avatar finalization without verifying storage twice", async () => {
  const ownerId = personaId("owner");
  let verifications = 0;
  const storageLayer = Layer.succeed(
    Storage,
    Storage.of({
      copyObject: () => Effect.void,
      deleteObject: () => Effect.void,
      signDownload: () => Effect.succeed("https://private.example/download"),
      signPreview: () => Effect.succeed("https://private.example/preview"),
      signUpload: () => Effect.succeed("https://private.example/upload"),
      verifyObject: () => {
        verifications += 1;
        return Effect.void;
      },
    })
  );
  const layers = Layer.mergeAll(
    IdempotencyLive,
    Layer.provide(UploadsLive, storageLayer)
  );

  const outcome = await Effect.runPromise(
    Effect.provide(
      Effect.gen(function* finalizeTwice() {
        const idempotency = yield* Idempotency;
        const service = yield* Uploads;
        const taskIntent = yield* service.requestTaskUpload(ownerId, {
          contentType: "application/pdf",
          fileName: "replay.pdf",
          sizeBytes: 2048,
          taskId: ids.taskId,
        });
        const finalize = () =>
          idempotency.run({
            actorId: ownerId,
            execute: () =>
              service.finalizeUpload(ownerId, taskIntent.uploadIntentId),
            input: { uploadIntentId: taskIntent.uploadIntentId },
            key: "upload-finalize-replay-0001",
            operation: "upload.finalize",
            resultSchema: FinalizedFileSchema,
          });
        const file = yield* finalize();
        const fileReplay = yield* finalize();
        const verificationsAfterFile = verifications;

        const avatarIntent = yield* service.requestAvatarUpload(ownerId, {
          contentType: "image/png",
          sizeBytes: 1024,
        });
        const finalizeAvatar = () =>
          idempotency.run({
            actorId: ownerId,
            execute: () =>
              service.finalizeAvatarUpload(
                ownerId,
                avatarIntent.uploadIntentId
              ),
            input: { uploadIntentId: avatarIntent.uploadIntentId },
            key: "avatar-finalize-replay-0001",
            operation: "avatar.finalize",
            resultSchema: AvatarUploadResultSchema,
          });
        const avatar = yield* finalizeAvatar();
        const avatarReplay = yield* finalizeAvatar();
        return {
          avatar,
          avatarReplay,
          file,
          fileReplay,
          verificationsAfterFile,
        };
      }),
      layers
    )
  );

  expect(outcome.fileReplay).toEqual(outcome.file);
  expect(outcome.avatarReplay).toEqual(outcome.avatar);
  // One storage check per finalization, not one per request.
  expect(outcome.verificationsAfterFile).toBe(1);
  expect(verifications).toBe(2);
  covered.add("finalizeUploadAction");
  covered.add("finalizeAvatarUploadAction");
});

it("replays personal, notification, and favorite mutations", async () => {
  const ownerId = personaId("owner");
  const viewBody = {
    filters: {},
    groupBy: null,
    hiddenColumns: [],
    isShared: false,
    name: "Replay view",
    projectId: null,
    sort: [],
    type: "list",
  };
  const view = await replay<{ id: string }>(
    "createSavedViewAction",
    "owner",
    savedViews.createSavedViewAction,
    { view: viewBody }
  );
  await replay(
    "updateSavedViewAction",
    "owner",
    savedViews.updateSavedViewAction,
    {
      view: { ...viewBody, name: "Replay view renamed" },
      viewId: view.id,
    }
  );
  await replay(
    "deleteSavedViewAction",
    "owner",
    savedViews.deleteSavedViewAction,
    {
      viewId: view.id,
    }
  );
  await replay(
    "savePersonalPreferencesAction",
    "owner",
    personalPreferences.savePersonalPreferencesAction,
    { preferences: {} }
  );
  await replay(
    "setNotificationPreferenceAction",
    "owner",
    notifications.setNotificationPreferenceAction,
    { channel: "in-app", enabled: true, eventType: "mention" }
  );
  const endpoint = `https://fcm.googleapis.com/${randomUUID()}`;
  await replay(
    "registerPushSubscriptionAction",
    "owner",
    notifications.registerPushSubscriptionAction,
    {
      endpoint,
      keys: { auth: "auth-key-123456", p256dh: "public-key-1234567890" },
      userAgent: null,
    }
  );
  await replay(
    "removePushSubscriptionAction",
    "owner",
    notifications.removePushSubscriptionAction,
    { endpoint }
  );
  const notificationId = randomUUID();
  await authPool.query(
    "INSERT INTO notification (id, \"userId\", type, text) VALUES ($1, $2, 'mention', 'Replay notification')",
    [notificationId, ownerId]
  );
  await replay(
    "markNotificationReadAction",
    "owner",
    notifications.markNotificationReadAction,
    { notificationId }
  );
  await replay(
    "markAllNotificationsReadAction",
    "owner",
    notifications.markAllNotificationsReadAction,
    {}
  );
  await replay(
    "toggleProjectFavoriteAction",
    "owner",
    discovery.toggleProjectFavoriteAction,
    { projectId: ids.projectId }
  );
  await replay(
    "toggleTaskFavoriteAction",
    "owner",
    discovery.toggleTaskFavoriteAction,
    { taskId: ids.taskId }
  );
});

// Mutations that must never be replayed from storage because their result is
// a credential or a short-lived signed URL, or because the action sits outside
// the workspace gate and is already naturally idempotent.
const READ_ACTION_PREFIX = /^(?:get|list|search)/u;

const excludedByDesign = new Set([
  "changeOwnPasswordAction",
  "createEmployeeAction",
  "requestAvatarUploadAction",
  "requestProjectUploadAction",
  "requestTaskUploadAction",
  "resetEmployeePasswordAction",
  "revokeSessionAction",
]);

it("accounts for every exported Server Action as a read, an exclusion, or a replayed mutation", () => {
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
  const unaccounted = [...exported].filter(
    (name) =>
      !READ_ACTION_PREFIX.test(name) &&
      !excludedByDesign.has(name) &&
      !covered.has(name)
  );
  expect(unaccounted).toEqual([]);
  for (const name of excludedByDesign) {
    expect(covered.has(name), `${name} must not be replayed`).toBe(false);
  }
});
