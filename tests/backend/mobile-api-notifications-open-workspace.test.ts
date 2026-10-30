import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import {
  authPool,
  createPersona,
  ids,
  personaBearerToken,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import type { OpenFixture } from "./support/mobile-notifications-fixtures";
import {
  callRoute,
  notificationRows,
  seedNotification,
  seedOpenFixture,
} from "./support/mobile-notifications-fixtures";

let fixture: OpenFixture;

beforeAll(async () => {
  await setupHarness();
  fixture = await seedOpenFixture(
    ids.clientCompanyId,
    ids.otherClientCompanyId,
    personaId("owner")
  );
});

afterAll(teardownHarness);

interface Opened {
  id: string;
  summary: { status: string; title: string };
  type: string;
}

const open = async (token: string, id: string) => {
  const { GET } =
    await import("../../apps/web/app/api/v1/workspace/notifications/[id]/target/route");
  return callRoute<Opened>(
    GET,
    "GET",
    `/api/v1/workspace/notifications/${id}/target`,
    { params: { id }, token }
  );
};

const setTaskArchivedAt = async (taskId: string, archivedAt: Date | null) => {
  await authPool.query(
    'UPDATE task SET "archivedAt" = $2, "archivedById" = CASE WHEN $2::timestamptz IS NULL THEN NULL ELSE "createdById" END WHERE id = $1',
    [taskId, archivedAt]
  );
};

it("opens the task a staff member's notification points at, with its title and status", async () => {
  const id = await seedNotification({
    targetId: fixture.staffTaskId,
    targetType: "task",
    userId: personaId("owner"),
  });

  const reply = await open(personaBearerToken("owner"), id);

  expect(reply.status).toBe(200);
  expect(reply.body.data).toEqual({
    id: fixture.staffTaskId,
    summary: { status: expect.any(String), title: "Staff task" },
    type: "task",
  });
});

it("opens the bug a staff member's notification points at", async () => {
  const id = await seedNotification({
    targetId: fixture.bugId,
    targetType: "bug",
    userId: personaId("owner"),
  });

  const reply = await open(personaBearerToken("owner"), id);

  expect(reply.status).toBe(200);
  expect(reply.body.data).toEqual({
    id: fixture.bugId,
    summary: { status: expect.any(String), title: "Client bug task" },
    type: "bug",
  });
});

it("refuses another person's notification exactly as it refuses one that does not exist", async () => {
  const theirs = await seedNotification({
    targetId: fixture.staffTaskId,
    targetType: "task",
    userId: personaId("outsider"),
  });
  const before = await notificationRows(personaId("outsider"));

  const refused = await open(personaBearerToken("owner"), theirs);
  const missing = await open(personaBearerToken("owner"), randomUUID());

  expect(refused.status).toBe(404);
  expect(refused.body.error).toMatchObject({
    code: missing.body.error.code,
    message: missing.body.error.message,
  });
  expect(JSON.stringify(refused.body)).not.toContain("Staff task");
  expect(await notificationRows(personaId("outsider"))).toEqual(before);
});

it("refuses a notification with no target, one whose task is gone and a request", async () => {
  const caller = personaId("owner");
  const bare = await seedNotification({ userId: caller });
  const gone = await seedNotification({
    targetId: randomUUID(),
    targetType: "task",
    userId: caller,
  });
  const approval = await seedNotification({
    targetId: fixture.approvalId,
    targetType: "approval",
    userId: caller,
  });
  const before = await notificationRows(caller);

  const replies = await Promise.all(
    [bare, gone, approval].map((id) => open(personaBearerToken("owner"), id))
  );

  expect(replies.map(({ status }) => status)).toEqual([404, 404, 404]);
  expect(replies[0]?.body.error.code).toBe("NOT_FOUND");
  expect(JSON.stringify(replies)).not.toContain("Design sign-off");
  expect(await notificationRows(caller)).toEqual(before);
});

it("refuses an archived task or bug, and opens them again when restored", async () => {
  const task = await seedNotification({
    targetId: fixture.staffTaskId,
    targetType: "task",
    userId: personaId("owner"),
  });
  const bug = await seedNotification({
    targetId: fixture.bugId,
    targetType: "bug",
    userId: personaId("owner"),
  });

  await setTaskArchivedAt(fixture.staffTaskId, new Date());
  await setTaskArchivedAt(fixture.bugTaskId, new Date());
  const archived = await Promise.all([
    open(personaBearerToken("owner"), task),
    open(personaBearerToken("owner"), bug),
  ]);
  await setTaskArchivedAt(fixture.staffTaskId, null);
  await setTaskArchivedAt(fixture.bugTaskId, null);
  const restored = await Promise.all([
    open(personaBearerToken("owner"), task),
    open(personaBearerToken("owner"), bug),
  ]);

  expect(archived.map(({ status }) => status)).toEqual([404, 404]);
  expect(restored.map(({ status }) => status)).toEqual([200, 200]);
});

it("keeps opening a task after the person was unassigned, because staff read access does not depend on assignment", async () => {
  const id = await seedNotification({
    targetId: fixture.staffTaskId,
    targetType: "task",
    userId: personaId("outsider"),
  });
  await authPool.query(
    'DELETE FROM task_assignee WHERE "taskId" = $1 AND "userId" = $2',
    [fixture.staffTaskId, personaId("outsider")]
  );

  const reply = await open(personaBearerToken("outsider"), id);

  expect(reply.status).toBe(200);
});

it("refuses a deactivated staff account, a client token, a missing token and a revoked token", async () => {
  const id = await seedNotification({
    targetId: fixture.staffTaskId,
    targetType: "task",
    userId: personaId("owner"),
  });
  const gone = await createPersona("employee", `open-${randomUUID()}`);
  const goneNotice = await seedNotification({
    targetId: fixture.staffTaskId,
    targetType: "task",
    userId: gone.id,
  });
  const revoked = await createPersona("employee", `open-${randomUUID()}`);
  const revokedNotice = await seedNotification({
    targetId: fixture.staffTaskId,
    targetType: "task",
    userId: revoked.id,
  });
  await authPool.query(
    'UPDATE "user" SET "deactivatedAt" = now(), "deactivatedById" = $2 WHERE id = $1',
    [gone.id, personaId("admin")]
  );
  await authPool.query('DELETE FROM session WHERE "userId" = $1', [revoked.id]);
  const before = await notificationRows(personaId("owner"));

  const client = await open(personaBearerToken("client"), id);
  const anonymous = await open("", id);
  const deactivated = await open(gone.bearerToken, goneNotice);
  const afterRevoke = await open(revoked.bearerToken, revokedNotice);

  expect(client.status).toBe(403);
  expect(anonymous.status).toBe(401);
  expect(deactivated.status).toBe(401);
  expect(afterRevoke.status).toBe(401);
  expect(await notificationRows(personaId("owner"))).toEqual(before);
});
