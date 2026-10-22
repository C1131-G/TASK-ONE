import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";

import { canViewerReceive } from "../../src/server/realtime/access";
import type {
  AccessLookups,
  RealtimeViewer,
} from "../../src/server/realtime/access";
import type { RealtimeEvent } from "../../src/server/realtime/events";

const companyId = randomUUID();
const taskId = randomUUID();
const projectId = randomUUID();

const viewer = (
  role: RealtimeViewer["role"],
  clientCompanyId: string | null = null
): RealtimeViewer => ({ clientCompanyId, id: randomUUID(), role });

const lookups = (
  overrides: Partial<{
    active: boolean;
    visibleTasks: readonly string[];
  }> = {}
): AccessLookups & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    clientCanSeeTask: (company, task) => {
      calls.push(`task:${company}:${task}`);
      return Promise.resolve((overrides.visibleTasks ?? []).includes(task));
    },
    isActive: (userId) => {
      calls.push(`active:${userId}`);
      return Promise.resolve(overrides.active ?? true);
    },
  };
};

const taskEvent: RealtimeEvent = { kind: "task", projectId, taskId };
const publicComment: RealtimeEvent = {
  kind: "comment",
  taskId,
  visibility: "public",
};
const internalComment: RealtimeEvent = {
  kind: "comment",
  taskId,
  visibility: "internal",
};
const projectEvent: RealtimeEvent = { kind: "project", projectId };

test("staff receive task, project and comment events", async () => {
  for (const role of ["admin", "employee"] as const) {
    const staff = viewer(role);
    for (const event of [
      taskEvent,
      projectEvent,
      publicComment,
      internalComment,
    ]) {
      // eslint-disable-next-line no-await-in-loop
      expect(await canViewerReceive(staff, event, lookups())).toBe(true);
    }
  }
});

test("a deactivated viewer receives nothing, not even their own inbox", async () => {
  const staff = viewer("employee");
  const gone = lookups({ active: false });
  expect(await canViewerReceive(staff, taskEvent, gone)).toBe(false);
  expect(
    await canViewerReceive(staff, { kind: "inbox", userId: staff.id }, gone)
  ).toBe(false);
});

test("an inbox event reaches only its own user", async () => {
  const staff = viewer("employee");
  const other = randomUUID();
  expect(
    await canViewerReceive(
      staff,
      { kind: "inbox", userId: staff.id },
      lookups()
    )
  ).toBe(true);
  expect(
    await canViewerReceive(staff, { kind: "inbox", userId: other }, lookups())
  ).toBe(false);
  const client = viewer("client", companyId);
  expect(
    await canViewerReceive(client, { kind: "inbox", userId: other }, lookups())
  ).toBe(false);
  expect(
    await canViewerReceive(
      client,
      { kind: "inbox", userId: client.id },
      lookups()
    )
  ).toBe(true);
});

test("a client receives events only for their own company's bug tasks", async () => {
  const client = viewer("client", companyId);
  expect(
    await canViewerReceive(
      client,
      taskEvent,
      lookups({ visibleTasks: [taskId] })
    )
  ).toBe(true);
  expect(await canViewerReceive(client, taskEvent, lookups())).toBe(false);
});

test("a client never receives internal comments or project events", async () => {
  const client = viewer("client", companyId);
  const visible = lookups({ visibleTasks: [taskId] });
  expect(await canViewerReceive(client, internalComment, visible)).toBe(false);
  expect(await canViewerReceive(client, projectEvent, visible)).toBe(false);
  expect(await canViewerReceive(client, publicComment, visible)).toBe(true);
  expect(await canViewerReceive(client, publicComment, lookups())).toBe(false);
});

test("a client without a company receives nothing about tasks", async () => {
  const orphan = viewer("client", null);
  const visible = lookups({ visibleTasks: [taskId] });
  expect(await canViewerReceive(orphan, taskEvent, visible)).toBe(false);
  expect(await canViewerReceive(orphan, publicComment, visible)).toBe(false);
});

test("internal comments are rejected before any task lookup for a client", async () => {
  const client = viewer("client", companyId);
  const spy = lookups({ visibleTasks: [taskId] });
  await canViewerReceive(client, internalComment, spy);
  expect(spy.calls.some((call) => call.startsWith("task:"))).toBe(false);
});
