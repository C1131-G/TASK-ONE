/* eslint-disable no-unused-vars */
import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer, Schema } from "effect";

import { CompanySettingsValuesSchema } from "../../src/server/company/company-settings";
import {
  authPool,
  callAs,
  EMAIL_DOMAIN,
  ids,
  nextKey,
  replay,
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
const companyQueries = await import("../../features/company/company-queries");
const { Idempotency, IdempotencyLive } =
  await import("../../src/server/core/idempotency");
const { Storage } = await import("../../src/server/storage/storage");
const { AvatarUploadResultSchema, FinalizedFileSchema, Uploads } =
  await import("../../src/server/storage/uploads-contracts");
const { UploadsLive } = await import("../../src/server/storage/uploads");

const unique = (): string => randomUUID().replaceAll("-", "").slice(0, 8);
const projectKey = (): string => `R${unique().slice(0, 6)}`.toUpperCase();

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

it("replays team, label, calendar, and company-settings mutations", async () => {
  const team = await replay(
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

  const label = await replay(
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
  const event = await replay(
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

  const current = await callAs("admin", companyQueries.getCompanySettings, {});
  if (!current.ok) {
    throw new Error("Company settings could not be read after replay.");
  }
  const settings = Schema.decodeUnknownSync(CompanySettingsValuesSchema)(
    current.data
  );
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
