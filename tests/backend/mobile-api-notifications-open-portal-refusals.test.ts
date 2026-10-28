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
    await import("../../app/api/v1/portal/notifications/[id]/target/route");
  return callRoute<Opened>(
    GET,
    "GET",
    `/api/v1/portal/notifications/${id}/target`,
    { params: { id }, token }
  );
};

// A client who can be moved, deactivated or signed out without disturbing the
// shared personas.
const freshClient = async (companyId: string = ids.clientCompanyId) => {
  const persona = await createPersona("employee", `open-${randomUUID()}`);
  await authPool.query(
    'UPDATE "user" SET role = \'client\', "clientCompanyId" = $2, "mustChangePassword" = false WHERE id = $1',
    [persona.id, companyId]
  );
  return persona;
};

const setTaskArchivedAt = async (taskId: string, archivedAt: Date | null) => {
  await authPool.query(
    'UPDATE task SET "archivedAt" = $2, "archivedById" = CASE WHEN $2::timestamptz IS NULL THEN NULL ELSE "createdById" END WHERE id = $1',
    [taskId, archivedAt]
  );
};

it("opens the bug behind a task target, since the bug is what a client can open", async () => {
  const id = await seedNotification({
    targetId: fixture.bugTaskId,
    targetType: "task",
    userId: personaId("client"),
  });

  const reply = await open(personaBearerToken("client"), id);

  expect(reply.status).toBe(200);
  expect(reply.body.data).toMatchObject({ id: fixture.bugId, type: "bug" });
});

it("opens a pending approval request of the caller's company with its title", async () => {
  const id = await seedNotification({
    targetId: fixture.approvalId,
    targetType: "approval",
    userId: personaId("client"),
  });

  const reply = await open(personaBearerToken("client"), id);

  expect(reply.status).toBe(200);
  expect(reply.body.data).toEqual({
    id: fixture.approvalId,
    summary: { status: "pending", title: "Design sign-off" },
    type: "approval",
  });
});

it("refuses another person's notification exactly as it refuses one that does not exist", async () => {
  const colleagues = await seedNotification({
    targetId: fixture.bugId,
    targetType: "bug",
    userId: personaId("coworker"),
  });
  const before = await notificationRows(personaId("coworker"));

  const theirs = await open(personaBearerToken("client"), colleagues);
  const missing = await open(personaBearerToken("client"), randomUUID());

  expect(theirs.status).toBe(404);
  expect(theirs.body.error).toMatchObject({
    code: missing.body.error.code,
    message: missing.body.error.message,
  });
  expect(JSON.stringify(theirs.body)).not.toContain(fixture.bugId);
  expect(await notificationRows(personaId("coworker"))).toEqual(before);
});

it("refuses a target of another company, whether it is a bug, its task or a request", async () => {
  const otherCompany = await authPool.query<{ taskId: string }>(
    'SELECT "taskId" FROM bug_report WHERE id = $1',
    [fixture.otherBugId]
  );
  const otherApprovalId = randomUUID();
  await authPool.query(
    `INSERT INTO approval_request (id, "projectId", "companyId", "taskId", "subjectKey", "subjectTitle", version, message, status, "requestedById", "requestedAt")
     SELECT $1, "projectId", $2, "taskId", $3, 'Other sign-off', 1, 'Please review', 'pending', "requestedById", now()
     FROM approval_request WHERE id = $4`,
    [
      otherApprovalId,
      ids.otherClientCompanyId,
      `task:${randomUUID()}`,
      fixture.approvalId,
    ]
  );
  const caller = personaId("client");
  const notifications = [
    await seedNotification({
      targetId: fixture.otherBugId,
      targetType: "bug",
      userId: caller,
    }),
    await seedNotification({
      targetId: otherCompany.rows[0]?.taskId ?? "",
      targetType: "task",
      userId: caller,
    }),
    await seedNotification({
      targetId: otherApprovalId,
      targetType: "approval",
      userId: caller,
    }),
  ];
  const before = await notificationRows(caller);

  const replies = await Promise.all(
    notifications.map((id) => open(personaBearerToken("client"), id))
  );

  expect(replies.map(({ status }) => status)).toEqual([404, 404, 404]);
  expect(JSON.stringify(replies)).not.toContain("Other sign-off");
  expect(await notificationRows(caller)).toEqual(before);
});

it("refuses a notification that records no target", async () => {
  const bare = await seedNotification({ userId: personaId("client") });
  const legacy = await seedNotification({
    taskId: fixture.bugTaskId,
    userId: personaId("client"),
  });

  const replies = await Promise.all([
    open(personaBearerToken("client"), bare),
    open(personaBearerToken("client"), legacy),
  ]);

  expect(replies.map(({ status }) => status)).toEqual([404, 404]);
  expect(replies[0]?.body.error.code).toBe("NOT_FOUND");
});

it("never opens a staff-only task for a client", async () => {
  const internal = await seedNotification({
    targetId: fixture.internalTaskId,
    targetType: "task",
    userId: personaId("client"),
  });
  const staffTask = await seedNotification({
    targetId: fixture.staffTaskId,
    targetType: "task",
    userId: personaId("client"),
  });

  const replies = await Promise.all([
    open(personaBearerToken("client"), internal),
    open(personaBearerToken("client"), staffTask),
  ]);

  expect(replies.map(({ status }) => status)).toEqual([404, 404]);
  expect(JSON.stringify(replies)).not.toContain("Internal task");
  expect(JSON.stringify(replies)).not.toContain("Staff task");
});

it("refuses once the bug is archived, and opens it again when it is restored", async () => {
  const id = await seedNotification({
    targetId: fixture.bugId,
    targetType: "bug",
    userId: personaId("client"),
  });

  await setTaskArchivedAt(fixture.bugTaskId, new Date());
  const archived = await open(personaBearerToken("client"), id);
  await setTaskArchivedAt(fixture.bugTaskId, null);
  const restored = await open(personaBearerToken("client"), id);

  expect(archived.status).toBe(404);
  expect(restored.status).toBe(200);
});

it("refuses a request that was cancelled and a bug that no longer exists", async () => {
  const cancelledId = randomUUID();
  await authPool.query(
    `INSERT INTO approval_request (id, "projectId", "companyId", "taskId", "subjectKey", "subjectTitle", version, message, status, "requestedById", "requestedAt", "cancelledById", "cancelledAt")
     SELECT $1, "projectId", "companyId", "taskId", $2, 'Cancelled sign-off', 1, 'Please review', 'cancelled', "requestedById", now(), "requestedById", now()
     FROM approval_request WHERE id = $3`,
    [cancelledId, `task:${randomUUID()}`, fixture.approvalId]
  );
  const cancelled = await seedNotification({
    targetId: cancelledId,
    targetType: "approval",
    userId: personaId("client"),
  });
  const gone = await seedNotification({
    targetId: randomUUID(),
    targetType: "bug",
    userId: personaId("client"),
  });

  const replies = await Promise.all([
    open(personaBearerToken("client"), cancelled),
    open(personaBearerToken("client"), gone),
  ]);

  expect(replies.map(({ status }) => status)).toEqual([404, 404]);
});

it("refuses a client who moved to another company after the notification was created", async () => {
  const mover = await freshClient();
  const id = await seedNotification({
    targetId: fixture.bugId,
    targetType: "bug",
    userId: mover.id,
  });
  const opened = await open(mover.bearerToken, id);
  await authPool.query(
    'UPDATE "user" SET "clientCompanyId" = $2 WHERE id = $1',
    [mover.id, ids.otherClientCompanyId]
  );
  const before = await notificationRows(mover.id);

  const moved = await open(mover.bearerToken, id);

  expect(opened.status).toBe(200);
  expect(moved.status).toBe(404);
  expect(await notificationRows(mover.id)).toEqual(before);
});

it("refuses a client whose account or company was deactivated", async () => {
  const account = await freshClient();
  const accountNotice = await seedNotification({
    targetId: fixture.bugId,
    targetType: "bug",
    userId: account.id,
  });
  await authPool.query(
    'UPDATE "user" SET "deactivatedAt" = now(), "deactivatedById" = $2 WHERE id = $1',
    [account.id, personaId("admin")]
  );
  const companyId = randomUUID();
  await authPool.query(
    'INSERT INTO client_company (id, name, "createdById") VALUES ($1, $2, $3)',
    [companyId, `Open company ${companyId}`, personaId("admin")]
  );
  const member = await freshClient(companyId);
  const memberNotice = await seedNotification({
    targetId: fixture.bugId,
    targetType: "bug",
    userId: member.id,
  });
  await authPool.query(
    'UPDATE client_company SET "deactivatedAt" = now(), "deactivatedById" = $2 WHERE id = $1',
    [companyId, personaId("admin")]
  );

  const deactivatedAccount = await open(account.bearerToken, accountNotice);
  const deactivatedCompany = await open(member.bearerToken, memberNotice);

  expect(deactivatedAccount.status).toBe(401);
  expect([401, 403, 404]).toContain(deactivatedCompany.status);
});

it("refuses a staff token, a missing token and a revoked token", async () => {
  const id = await seedNotification({
    targetId: fixture.bugId,
    targetType: "bug",
    userId: personaId("client"),
  });
  const revoked = await freshClient();
  const own = await seedNotification({
    targetId: fixture.bugId,
    targetType: "bug",
    userId: revoked.id,
  });
  await authPool.query('DELETE FROM session WHERE "userId" = $1', [revoked.id]);
  const before = await notificationRows(personaId("client"));

  const staff = await open(personaBearerToken("owner"), id);
  const anonymous = await open("", id);
  const afterRevoke = await open(revoked.bearerToken, own);

  expect(staff.status).toBe(403);
  expect(anonymous.status).toBe(401);
  expect(afterRevoke.status).toBe(401);
  expect(await notificationRows(personaId("client"))).toEqual(before);
});
