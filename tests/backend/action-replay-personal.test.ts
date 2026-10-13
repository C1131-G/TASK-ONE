/* eslint-disable no-unused-vars */
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

const calendar = await import("../../features/calendar/calendar-actions");
const comments = await import("../../features/tasks/actions/task-comments");
const companySettings = await import("../../features/company/company-actions");
const dashboard = await import("../../features/dashboard/dashboard-queries");
const discovery = await import("../../features/discovery/discovery-actions");
const employees = await import("../../features/people/people-actions");
const jobs = await import("../../features/jobs/jobs-queries");
const labels = await import("../../features/tasks/actions/labels");
const notifications =
  await import("../../features/notifications/notifications-actions");
const password = await import("../../features/user/actions/password");
const personalPreferences =
  await import("../../features/user/actions/personal-preferences");
const projects = await import("../../features/projects/projects-actions");
const savedViews = await import("../../features/projects/actions/saved-views");
const sessions = await import("../../features/user/actions/sessions");
const subtasks = await import("../../features/tasks/actions/subtasks");
const tasks = await import("../../features/tasks/tasks-actions");
const teams = await import("../../features/people/actions/teams");
const uploads = await import("../../features/files/files-actions");
const { Idempotency, IdempotencyLive } =
  await import("../../src/server/core/idempotency");
const { Storage } = await import("../../src/server/storage/storage");
const { AvatarUploadResultSchema, FinalizedFileSchema, Uploads } =
  await import("../../src/server/storage/uploads-contracts");
const { UploadsLive } = await import("../../src/server/storage/uploads");

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

beforeAll(async () => {
  await setupHarness();
  state.projectId = ids.projectId;
  state.taskId = ids.taskId;
});
afterAll(teardownHarness);

it("replays personal, notification, and favorite mutations", async () => {
  const ownerId = personaId("owner");
  const viewBody = {
    filters: { priority: [], query: "", status: [] },
    groupBy: null,
    hiddenColumns: [],
    isShared: false,
    name: "Replay view",
    projectId: null,
    sort: { direction: "asc", field: "manual" },
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
    "saveTaskTableColumnWidthsAction",
    "owner",
    personalPreferences.saveTaskTableColumnWidthsAction,
    { columnWidths: { due: 140 } }
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
