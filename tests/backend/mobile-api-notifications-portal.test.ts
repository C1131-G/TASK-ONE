import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Schema } from "effect";

import {
  authPool,
  callAs,
  createPersona,
  ids,
  personaBearerToken,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import {
  callRoute,
  notificationRows,
  seedNotification,
} from "./support/mobile-notifications-fixtures";

// Imported after the harness so the mocked request headers are in place.
const portalQueries = await import("../../features/portal/portal-queries");

interface PortalNotification {
  approvalId: string | null;
  bugId: string | null;
  createdAt: string;
  id: string;
  readAt: string | null;
  snippet: string | null;
  text: string;
  title: string;
}

interface PortalInbox {
  items: PortalNotification[];
  unreadCount: number;
}

const fixture = {
  cancelledApprovalId: "",
  cancelledApprovalTaskId: "",
  clientBugId: "",
  clientBugTaskId: "",
  internalTaskId: "",
  legacyApprovalId: "",
  legacyApprovalTaskId: "",
  otherApprovalId: "",
  otherApprovalTaskId: "",
  otherBugId: "",
  otherBugTaskId: "",
  projectId: "",
  visibleApprovalId: "",
  visibleApprovalTaskId: "",
};

const legacyRequestedAt = new Date("2026-04-02T10:00:00Z");

beforeAll(async () => {
  await setupHarness();
  const owner = personaId("owner");
  Object.assign(fixture, {
    cancelledApprovalId: randomUUID(),
    cancelledApprovalTaskId: randomUUID(),
    clientBugId: randomUUID(),
    clientBugTaskId: randomUUID(),
    internalTaskId: randomUUID(),
    legacyApprovalId: randomUUID(),
    legacyApprovalTaskId: randomUUID(),
    otherApprovalId: randomUUID(),
    otherApprovalTaskId: randomUUID(),
    otherBugId: randomUUID(),
    otherBugTaskId: randomUUID(),
    projectId: randomUUID(),
    visibleApprovalId: randomUUID(),
    visibleApprovalTaskId: randomUUID(),
  });
  await authPool.query(
    'INSERT INTO project (id, key, name, "clientVisible") VALUES ($1, $2, $3, true)',
    [
      fixture.projectId,
      `MN${randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()}`,
      "Harness mobile notifications project",
    ]
  );
  await authPool.query(
    'INSERT INTO client_company_project (id, "companyId", "projectId") VALUES ($1, $2, $3), ($4, $5, $3)',
    [
      randomUUID(),
      ids.clientCompanyId,
      fixture.projectId,
      randomUUID(),
      ids.otherClientCompanyId,
    ]
  );
  await authPool.query(
    `INSERT INTO task (id, "projectId", "projectTaskNumber", title, "clientVisible", "createdById") VALUES
      ($1, $2, 1, 'Client bug task', true, $3),
      ($4, $2, 2, 'Other client bug task', true, $3),
      ($5, $2, 3, 'Internal task', false, $3),
      ($6, $2, 4, 'Visible approval task', true, $3),
      ($7, $2, 5, 'Cancelled approval task', true, $3),
      ($8, $2, 6, 'Other company approval task', true, $3),
      ($9, $2, 7, 'Legacy approval task', true, $3)`,
    [
      fixture.clientBugTaskId,
      fixture.projectId,
      owner,
      fixture.otherBugTaskId,
      fixture.internalTaskId,
      fixture.visibleApprovalTaskId,
      fixture.cancelledApprovalTaskId,
      fixture.otherApprovalTaskId,
      fixture.legacyApprovalTaskId,
    ]
  );
  await authPool.query(
    `INSERT INTO bug_report (id, "taskId", "projectId", "reporterId", severity, "discoverySource", environment, component, route, "expectedBehavior", "actualBehavior", "reproductionSteps", "clientCompanyId", "clientImpact") VALUES
      ($1, $2, $3, $4, 'minor', 'customer_report', 'production', 'Client report', '/page', 'It works', 'It breaks', ARRAY['Open it'], $5, 'medium'),
      ($6, $7, $3, $4, 'minor', 'customer_report', 'production', 'Client report', '/page', 'It works', 'It breaks', ARRAY['Open it'], $8, 'medium')`,
    [
      fixture.clientBugId,
      fixture.clientBugTaskId,
      fixture.projectId,
      owner,
      ids.clientCompanyId,
      fixture.otherBugId,
      fixture.otherBugTaskId,
      ids.otherClientCompanyId,
    ]
  );
  await authPool.query(
    `INSERT INTO approval_request (id, "projectId", "companyId", "taskId", "subjectKey", "subjectTitle", version, message, status, "requestedById", "requestedAt", "cancelledById", "cancelledAt") VALUES
      ($1, $2, $3, $4, $5, 'Design sign-off', 1, 'Please review', 'pending', $6, $7, NULL, NULL),
      ($8, $2, $3, $9, $10, 'Cancelled sign-off', 1, 'Please review', 'cancelled', $6, $7, $6, now()),
      ($11, $2, $12, $13, $14, 'Other sign-off', 1, 'Please review', 'pending', $6, $7, NULL, NULL),
      ($15, $2, $3, $16, $17, 'Legacy logo', 1, 'Review please', 'pending', $6, $18, NULL, NULL)`,
    [
      fixture.visibleApprovalId,
      fixture.projectId,
      ids.clientCompanyId,
      fixture.visibleApprovalTaskId,
      `task:${fixture.visibleApprovalTaskId}`,
      owner,
      new Date("2026-03-01T09:00:00Z"),
      fixture.cancelledApprovalId,
      fixture.cancelledApprovalTaskId,
      `task:${fixture.cancelledApprovalTaskId}`,
      fixture.otherApprovalId,
      ids.otherClientCompanyId,
      fixture.otherApprovalTaskId,
      `task:${fixture.otherApprovalTaskId}`,
      fixture.legacyApprovalId,
      fixture.legacyApprovalTaskId,
      `task:${fixture.legacyApprovalTaskId}`,
      legacyRequestedAt,
    ]
  );
});

afterAll(teardownHarness);

const notificationUsers = () => [
  personaId("client"),
  personaId("coworker"),
  personaId("otherClient"),
];

const clearNotifications = async (): Promise<void> => {
  await authPool.query(
    'DELETE FROM notification WHERE "userId" = ANY($1::text[])',
    [notificationUsers()]
  );
};

const inbox = async (token: string = personaBearerToken("client")) => {
  const { GET } =
    await import("../../apps/web/app/api/v1/portal/notifications/route");
  return callRoute<PortalInbox>(GET, "GET", "/api/v1/portal/notifications", {
    token,
  });
};

const markRead = async (
  token: string,
  id: string,
  key: string | null = `portal-read-${randomUUID()}`
) => {
  const { POST } =
    await import("../../apps/web/app/api/v1/portal/notifications/[id]/read/route");
  return callRoute<{ done: true }>(
    POST,
    "POST",
    `/api/v1/portal/notifications/${id}/read`,
    { key, params: { id }, token }
  );
};

const markAllRead = async (
  token: string,
  key: string | null = `portal-all-${randomUUID()}`
) => {
  const { POST } =
    await import("../../apps/web/app/api/v1/portal/notifications/read-all/route");
  return callRoute<{ count: number }>(
    POST,
    "POST",
    "/api/v1/portal/notifications/read-all",
    { key, token }
  );
};

const workspaceInbox = async (token: string) => {
  const { GET } =
    await import("../../apps/web/app/api/v1/workspace/notifications/route");
  return callRoute(GET, "GET", "/api/v1/workspace/notifications", { token });
};

const readAt = async (id: string): Promise<Date | null> => {
  const result = await authPool.query<{ readAt: Date | null }>(
    'SELECT "readAt" FROM notification WHERE id = $1',
    [id]
  );
  return result.rows[0]?.readAt ?? null;
};

it("lists only the caller's notifications, newest first, with the unread count", async () => {
  await clearNotifications();
  const older = await seedNotification({
    createdAt: new Date("2026-03-01T10:00:00Z"),
    readAt: new Date("2026-03-01T11:00:00Z"),
    targetId: fixture.clientBugId,
    targetType: "bug",
    text: "Older update",
    userId: personaId("client"),
  });
  const newer = await seedNotification({
    createdAt: new Date("2026-03-02T10:00:00Z"),
    snippet: "A snippet",
    targetId: fixture.clientBugId,
    targetType: "bug",
    text: "Newer update",
    userId: personaId("client"),
  });
  await seedNotification({
    targetId: fixture.clientBugId,
    targetType: "bug",
    text: "A colleague's",
    userId: personaId("coworker"),
  });
  await seedNotification({
    targetId: fixture.otherBugId,
    targetType: "bug",
    text: "Another company's",
    userId: personaId("otherClient"),
  });

  const reply = await inbox();
  const [first] = reply.body.data.items;
  if (!first) {
    throw new Error("The mobile inbox returned no items.");
  }

  expect(reply.status).toBe(200);
  expect(reply.body.data.items.map(({ id }) => id)).toEqual([newer, older]);
  expect(reply.body.data.unreadCount).toBe(1);
  expect(first).toMatchObject({
    approvalId: null,
    bugId: fixture.clientBugId,
    id: newer,
    readAt: null,
    snippet: "A snippet",
    text: "Newer update",
    title: "Newer update",
  });
  expect(Object.keys(first).toSorted()).toEqual([
    "approvalId",
    "bugId",
    "createdAt",
    "id",
    "readAt",
    "snippet",
    "text",
    "title",
  ]);
});

it("returns a bug of the caller's company and omits another company's bug", async () => {
  await clearNotifications();
  await seedNotification({
    createdAt: new Date("2026-03-04T10:00:00Z"),
    targetId: fixture.otherBugId,
    targetType: "bug",
    text: "Another company's bug",
    userId: personaId("client"),
  });
  await seedNotification({
    createdAt: new Date("2026-03-05T10:00:00Z"),
    targetId: fixture.otherBugTaskId,
    targetType: "task",
    text: "Another company's bug task",
    userId: personaId("client"),
  });
  const mine = await seedNotification({
    createdAt: new Date("2026-03-03T10:00:00Z"),
    targetId: fixture.clientBugId,
    targetType: "bug",
    text: "Our bug",
    userId: personaId("client"),
  });

  const reply = await inbox();

  expect(reply.status).toBe(200);
  expect(reply.body.data.items.map(({ id }) => id)).toEqual([mine]);
  expect(reply.body.data.items[0]).toMatchObject({
    approvalId: null,
    bugId: fixture.clientBugId,
  });
  expect(reply.body.data.unreadCount).toBe(1);
});

it("omits a notification that targets an internal task", async () => {
  await clearNotifications();
  await seedNotification({
    targetId: fixture.internalTaskId,
    targetType: "task",
    text: "Internal task update",
    userId: personaId("client"),
  });
  await seedNotification({
    taskId: fixture.internalTaskId,
    text: "Legacy internal task update",
    userId: personaId("client"),
  });

  const reply = await inbox();

  expect(reply.status).toBe(200);
  expect(reply.body.data.items).toEqual([]);
  expect(reply.body.data.unreadCount).toBe(0);
});

it("returns a visible approval request and omits a cancelled or another company's one", async () => {
  await clearNotifications();
  await seedNotification({
    targetId: fixture.visibleApprovalId,
    targetType: "approval",
    text: "Approval requested: Design sign-off",
    userId: personaId("client"),
  });
  await seedNotification({
    targetId: fixture.cancelledApprovalId,
    targetType: "approval",
    text: "Approval requested: Cancelled sign-off",
    userId: personaId("client"),
  });
  await seedNotification({
    targetId: fixture.otherApprovalId,
    targetType: "approval",
    text: "Approval requested: Other sign-off",
    userId: personaId("client"),
  });

  const reply = await inbox();

  expect(reply.status).toBe(200);
  expect(reply.body.data.items).toHaveLength(1);
  expect(reply.body.data.items[0]).toMatchObject({
    approvalId: fixture.visibleApprovalId,
    bugId: null,
  });
  expect(reply.body.data.unreadCount).toBe(1);
});

it("re-authorizes a legacy notification and omits one that has no visible target", async () => {
  await clearNotifications();
  await seedNotification({
    text: "Nothing to open",
    userId: personaId("client"),
  });
  await seedNotification({
    taskId: fixture.internalTaskId,
    text: "Legacy internal task update",
    userId: personaId("client"),
  });
  const legacyBug = await seedNotification({
    createdAt: new Date("2026-04-01T10:00:00Z"),
    taskId: fixture.clientBugTaskId,
    text: "Legacy bug update",
    userId: personaId("client"),
  });
  const legacyApproval = await seedNotification({
    actorId: personaId("owner"),
    createdAt: legacyRequestedAt,
    projectId: fixture.projectId,
    text: "Approval requested: Legacy logo",
    type: "status",
    userId: personaId("client"),
  });

  const reply = await inbox();

  expect(reply.status).toBe(200);
  expect(reply.body.data.items.map(({ id }) => id)).toEqual([
    legacyApproval,
    legacyBug,
  ]);
  expect(reply.body.data.items[0]).toMatchObject({
    approvalId: fixture.legacyApprovalId,
    bugId: null,
  });
  expect(reply.body.data.items[1]).toMatchObject({
    approvalId: null,
    bugId: fixture.clientBugId,
  });
  expect(reply.body.data.unreadCount).toBe(2);
});

it("refuses the wrong audience and a revoked token without touching any row", async () => {
  await clearNotifications();
  await seedNotification({
    targetId: fixture.clientBugId,
    targetType: "bug",
    text: "Still unread",
    userId: personaId("client"),
  });
  const before = await notificationRows(personaId("client"));

  const staff = await inbox(personaBearerToken("owner"));
  const workspace = await workspaceInbox(personaBearerToken("client"));
  const anonymous = await inbox("");
  const revoked = await createPersona("employee", `revoked-${randomUUID()}`);
  await authPool.query(
    'UPDATE "user" SET role = \'client\', "clientCompanyId" = $2, "mustChangePassword" = false WHERE id = $1',
    [revoked.id, ids.clientCompanyId]
  );
  const beforeRevoke = await inbox(revoked.bearerToken);
  await authPool.query('DELETE FROM session WHERE "userId" = $1', [revoked.id]);
  const afterRevoke = await inbox(revoked.bearerToken);

  expect(staff.status).toBe(403);
  expect(workspace.status).toBe(403);
  expect(anonymous.status).toBe(401);
  expect(beforeRevoke.status).toBe(200);
  expect(afterRevoke.status).toBe(401);
  expect(await notificationRows(personaId("client"))).toEqual(before);
});

it("marks one and all of the caller's notifications only, replaying a retry", async () => {
  await clearNotifications();
  const client = personaId("client");
  const first = await seedNotification({
    targetId: fixture.clientBugId,
    targetType: "bug",
    text: "First",
    userId: client,
  });
  const second = await seedNotification({ text: "Second", userId: client });
  const third = await seedNotification({ text: "Third", userId: client });
  const colleague = await seedNotification({
    text: "Colleague's",
    userId: personaId("coworker"),
  });
  const other = await seedNotification({
    text: "Another client's",
    userId: personaId("otherClient"),
  });

  const key = `portal-read-${randomUUID()}`;
  const firstRead = await markRead(personaBearerToken("client"), first, key);
  const firstReadAt = await readAt(first);
  const retry = await markRead(personaBearerToken("client"), first, key);
  const otherPersons = await markRead(personaBearerToken("client"), colleague);

  expect(firstRead.status).toBe(200);
  expect(firstRead.body.data).toEqual({ done: true });
  expect(firstReadAt).not.toBeNull();
  expect(retry.body.data).toEqual({ done: true });
  const afterRetry = await readAt(first);
  expect(afterRetry?.getTime()).toBe(firstReadAt?.getTime());
  expect(otherPersons.status).toBe(404);
  expect(await readAt(colleague)).toBeNull();

  const allKey = `portal-all-${randomUUID()}`;
  const all = await markAllRead(personaBearerToken("client"), allKey);
  const allRetry = await markAllRead(personaBearerToken("client"), allKey);

  expect(all.status).toBe(200);
  expect(all.body.data.count).toBe(2);
  expect(allRetry.body.data).toEqual(all.body.data);
  expect(await readAt(second)).not.toBeNull();
  expect(await readAt(third)).not.toBeNull();
  expect(await readAt(colleague)).toBeNull();
  expect(await readAt(other)).toBeNull();
});

it("leaves notification rows unchanged when a write is refused", async () => {
  await clearNotifications();
  const mine = await seedNotification({
    targetId: fixture.clientBugId,
    targetType: "bug",
    text: "Mine",
    userId: personaId("client"),
  });
  const colleague = await seedNotification({
    text: "Colleague's",
    userId: personaId("coworker"),
  });
  const before = await notificationRows(personaId("client"));

  const staffRead = await markRead(personaBearerToken("owner"), mine);
  const anonymousRead = await markRead("", mine);
  const missingKey = await markRead(personaBearerToken("client"), mine, null);
  const badId = await markRead(personaBearerToken("client"), "not-a-uuid");
  const anotherPersons = await markRead(
    personaBearerToken("client"),
    colleague
  );
  const staffAll = await markAllRead(personaBearerToken("owner"));
  const missingKeyAll = await markAllRead(personaBearerToken("client"), null);

  expect(staffRead.status).toBe(403);
  expect(anonymousRead.status).toBe(401);
  expect(missingKey.status).toBe(422);
  expect(badId.status).toBe(422);
  expect(anotherPersons.status).toBe(404);
  expect(staffAll.status).toBe(403);
  expect(missingKeyAll.status).toBe(422);
  expect(await notificationRows(personaId("client"))).toEqual(before);
  expect(await readAt(colleague)).toBeNull();
});

it("gives the app id, title, createdAt and readAt, and leaves the web portal response untouched", async () => {
  await clearNotifications();
  const createdAt = new Date("2026-05-01T10:00:00Z");
  const notification = await seedNotification({
    createdAt,
    targetId: fixture.clientBugId,
    targetType: "bug",
    taskId: fixture.clientBugTaskId,
    text: "Bug update",
    userId: personaId("client"),
  });

  const mobile = await inbox();
  const appItem = Schema.Struct({
    createdAt: Schema.String,
    id: Schema.String,
    readAt: Schema.NullOr(Schema.String),
    title: Schema.String,
  });
  const [firstItem] = mobile.body.data.items;
  if (!firstItem) {
    throw new Error("The mobile inbox returned no items.");
  }
  const decoded = Schema.decodeUnknownSync(appItem)(firstItem);

  expect(mobile.status).toBe(200);
  expect(decoded).toEqual({
    createdAt: createdAt.toISOString(),
    id: notification,
    readAt: null,
    title: "Bug update",
  });
  expect(firstItem.title).toBe(firstItem.text);

  const web = await callAs("client", portalQueries.listPortalNotifications, {});
  if (!web.ok) {
    throw new Error(web.error.message);
  }
  expect(JSON.stringify(web.data)).toBe(
    JSON.stringify({
      items: [
        {
          approvalId: null,
          bugId: fixture.clientBugId,
          createdAt: createdAt.toISOString(),
          id: notification,
          readAt: null,
          snippet: null,
          text: "Bug update",
        },
      ],
      unreadCount: 1,
    })
  );
  const webData = web.data as { items: readonly Record<string, unknown>[] };
  const [webItem] = webData.items;
  expect(webItem && Object.hasOwn(webItem, "title")).toBe(false);
});
