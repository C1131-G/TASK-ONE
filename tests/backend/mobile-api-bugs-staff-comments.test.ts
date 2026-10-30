import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import {
  authPool,
  ids,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import {
  linkProjectToCompanies,
  reportBody,
  send,
  setHandlers,
} from "./support/mobile-bugs-fixtures";

beforeAll(async () => {
  await setupHarness();
  await linkProjectToCompanies();
  await setHandlers(ids.clientCompanyId, ["owner"]);
});
afterAll(teardownHarness);

const submitRoute = () => import("../../apps/web/app/api/v1/portal/bugs/route");
const pickRoute = () =>
  import("../../apps/web/app/api/v1/workspace/bugs/[bugId]/pick/route");
const commentsRoute = () =>
  import("../../apps/web/app/api/v1/workspace/bugs/[bugId]/comments/route");
const portalDetailRoute = () =>
  import("../../apps/web/app/api/v1/portal/bugs/[bugId]/route");
const portalCommentsRoute = () =>
  import("../../apps/web/app/api/v1/portal/bugs/[bugId]/comments/route");

// A client report that the company's handler has picked up, so the handler is
// the bug's assignee.
const pickedBug = async (title: string): Promise<string> => {
  const { POST: submit } = await submitRoute();
  const submitted = await send(submit, "POST", "client", {
    body: reportBody(title),
  });
  const bugId = submitted.body.data.bugId as string;
  const { POST: pick } = await pickRoute();
  const picked = await send(pick, "POST", "owner", {
    body: { expectedVersion: 1, priority: "high", severity: "major" },
    params: { bugId },
  });
  expect(picked.status).toBe(200);
  return bugId;
};

const reportInternalBug = async (title: string): Promise<string> => {
  const { BugManagement, BugManagementLive } =
    await import("../../src/server/work/bug-management");
  const report = await Effect.runPromise(
    Effect.provide(
      Effect.gen(function* reportInternal() {
        const bugs = yield* BugManagement;
        return yield* bugs.reportBug(personaId("owner"), {
          actualBehavior: "Hangs.",
          appVersion: null,
          browser: null,
          component: "Dialog",
          description: null,
          device: null,
          discoverySource: "internal_qa",
          environment: "staging",
          expectedBehavior: "Closes.",
          os: null,
          projectId: ids.projectId,
          reproductionSteps: ["Open"],
          route: "/x",
          severity: "minor",
          title,
        });
      }),
      BugManagementLive
    )
  );
  return report.id;
};

interface CommentRow {
  readonly body: string;
  readonly visibility: string;
}

const commentRows = async (bugId: string): Promise<readonly CommentRow[]> => {
  const result = await authPool.query<CommentRow>(
    'SELECT c.body, c.visibility FROM comment c JOIN bug_report b ON b."taskId" = c."taskId" WHERE b.id = $1 ORDER BY c."createdAt", c.id',
    [bugId]
  );
  return result.rows;
};

interface NotificationRow {
  readonly type: string;
  readonly userId: string;
}

const notificationsFor = async (
  bugId: string
): Promise<readonly NotificationRow[]> => {
  const result = await authPool.query<NotificationRow>(
    'SELECT n."userId", n.type FROM notification n JOIN bug_report b ON b."taskId" = n."taskId" WHERE b.id = $1 ORDER BY n.type, n."userId"',
    [bugId]
  );
  return result.rows;
};

const portalDetail = async (bugId: string) => {
  const { GET } = await portalDetailRoute();
  return await send(GET, "GET", "client", { params: { bugId } });
};

it("lets the assigned handler leave an internal note that is stored as internal", async () => {
  const bugId = await pickedBug("Internal note");
  const { POST } = await commentsRoute();

  const reply = await send(POST, "POST", "owner", {
    body: { body: "Looks like the cache.", visibility: "internal" },
    params: { bugId },
  });

  expect(reply.status).toBe(200);
  expect(reply.body.data).toMatchObject({
    body: "Looks like the cache.",
    bugId,
    visibility: "internal",
  });
  expect(await commentRows(bugId)).toEqual([
    { body: "Looks like the cache.", visibility: "internal" },
  ]);
});

// Characterization from here on: the comment service already holds every rule
// (visibility, the handler restriction, mentions), so these pass as soon as the
// route adapts it.
it("keeps an internal note out of every portal read and notice", async () => {
  const bugId = await pickedBug("Hidden note");
  const { POST } = await commentsRoute();
  await send(POST, "POST", "owner", {
    body: { body: "SECRET-INTERNAL-NOTE", visibility: "internal" },
    params: { bugId },
  });

  const detail = await portalDetail(bugId);
  const { GET: list } =
    await import("../../apps/web/app/api/v1/portal/bug-reports/route");
  const listed = await send(list, "GET", "client");
  const notices = await authPool.query(
    'SELECT 1 FROM notification WHERE "userId" = $1 AND snippet LIKE $2',
    [personaId("client"), "%SECRET-INTERNAL%"]
  );

  expect(detail.status).toBe(200);
  expect(detail.body.data.comments).toEqual([]);
  expect(JSON.stringify(detail.body.data)).not.toContain("SECRET-INTERNAL");
  expect(JSON.stringify(listed.body)).not.toContain("SECRET-INTERNAL");
  expect(notices.rowCount).toBe(0);
});

it("shows a client-visible reply to the client as a team message and notifies the reporter", async () => {
  const bugId = await pickedBug("Visible reply");
  const { POST } = await commentsRoute();

  const reply = await send(POST, "POST", "owner", {
    body: { body: "We are on it.", visibility: "public" },
    params: { bugId },
  });

  expect(reply.status).toBe(200);
  expect(reply.body.data.visibility).toBe("public");
  const detail = await portalDetail(bugId);
  expect(detail.body.data.comments).toMatchObject([
    { body: "We are on it.", isMine: false, isTeam: true },
  ]);
  expect(await notificationsFor(bugId)).toContainEqual({
    type: "comment",
    userId: personaId("client"),
  });
});

it("lets an admin reply on a bug they do not handle", async () => {
  const bugId = await pickedBug("Admin reply");
  const { POST } = await commentsRoute();

  const reply = await send(POST, "POST", "admin", {
    body: { body: "Admin here.", visibility: "public" },
    params: { bugId },
  });

  expect(reply.status).toBe(200);
  expect(await commentRows(bugId)).toEqual([
    { body: "Admin here.", visibility: "public" },
  ]);
});

it("refuses an employee who does not handle the bug, leaving the discussion unchanged", async () => {
  const bugId = await pickedBug("Not mine");
  const { POST } = await commentsRoute();
  const before = await notificationsFor(bugId);

  const internal = await send(POST, "POST", "outsider", {
    body: { body: "Let me in.", visibility: "internal" },
    params: { bugId },
  });
  const pub = await send(POST, "POST", "outsider", {
    body: { body: "Let me in.", visibility: "public" },
    params: { bugId },
  });

  expect(internal.status).toBe(403);
  expect(pub.status).toBe(403);
  expect(await commentRows(bugId)).toEqual([]);
  expect(await notificationsFor(bugId)).toEqual(before);
});

it("refuses a client-visible reply on an internal bug but accepts an internal note", async () => {
  const bugId = await reportInternalBug("Internal only");
  const { POST } = await commentsRoute();

  const pub = await send(POST, "POST", "owner", {
    body: { body: "Public?", visibility: "public" },
    params: { bugId },
  });
  const note = await send(POST, "POST", "owner", {
    body: { body: "Fine.", visibility: "internal" },
    params: { bugId },
  });

  expect(pub.status).toBe(422);
  expect(note.status).toBe(200);
  expect(await commentRows(bugId)).toEqual([
    { body: "Fine.", visibility: "internal" },
  ]);
});

it("answers 404 for a missing bug and 422 with field errors for bad input", async () => {
  const bugId = await pickedBug("Bad input");
  const { POST } = await commentsRoute();

  const missing = await send(POST, "POST", "owner", {
    body: { body: "Hello", visibility: "internal" },
    params: { bugId: "00000000-0000-4000-8000-000000000000" },
  });
  const empty = await send(POST, "POST", "owner", {
    body: { body: "", visibility: "internal" },
    params: { bugId },
  });
  const unknownVisibility = await send(POST, "POST", "owner", {
    body: { body: "Hi", visibility: "everyone" },
    params: { bugId },
  });
  const malformed = await send(POST, "POST", "owner", {
    body: { body: "Hi", visibility: "internal" },
    params: { bugId: "nope" },
  });
  const noKey = await send(POST, "POST", "owner", {
    body: { body: "Hi", visibility: "internal" },
    key: false,
    params: { bugId },
  });

  expect(missing.status).toBe(404);
  expect(empty.status).toBe(422);
  expect(empty.body.error.fieldErrors).toHaveProperty("body");
  expect(unknownVisibility.status).toBe(422);
  expect(unknownVisibility.body.error.fieldErrors).toHaveProperty("visibility");
  expect(malformed.status).toBe(422);
  expect(noKey.status).toBe(422);
  expect(await commentRows(bugId)).toEqual([]);
});

it("refuses clients and unauthenticated callers on the staff route, and staff on the portal route", async () => {
  const bugId = await pickedBug("Wrong audience");
  const { POST } = await commentsRoute();
  const { POST: portalPost } = await portalCommentsRoute();
  const staffBody = { body: "Hi", visibility: "internal" };

  const client = await send(POST, "POST", "client", {
    body: staffBody,
    params: { bugId },
  });
  const anonymous = await send(POST, "POST", "anonymous", {
    body: staffBody,
    params: { bugId },
  });
  const revoked = await send(POST, "POST", "owner", {
    body: staffBody,
    params: { bugId },
    token: "revoked-token",
  });
  const staffOnPortal = await send(portalPost, "POST", "owner", {
    body: { body: "Hi" },
    params: { bugId },
  });

  expect(client.status).toBe(403);
  expect(anonymous.status).toBe(401);
  expect(revoked.status).toBe(401);
  expect(staffOnPortal.status).toBe(403);
  expect(await commentRows(bugId)).toEqual([]);
});

it("stores a retried reply once and refuses the same key with a different body", async () => {
  const bugId = await pickedBug("Retry");
  const { POST } = await commentsRoute();
  const body = { body: "Once only.", visibility: "public" };

  const first = await send(POST, "POST", "owner", {
    body,
    key: "bug-reply-key-1",
    params: { bugId },
  });
  const retry = await send(POST, "POST", "owner", {
    body,
    key: "bug-reply-key-1",
    params: { bugId },
  });
  const changed = await send(POST, "POST", "owner", {
    body: { ...body, body: "Something else." },
    key: "bug-reply-key-1",
    params: { bugId },
  });

  expect(first.status).toBe(200);
  expect(retry.status).toBe(200);
  expect(retry.body.data.id).toBe(first.body.data.id);
  expect(changed.status).toBe(409);
  expect(await commentRows(bugId)).toEqual([
    { body: "Once only.", visibility: "public" },
  ]);
});

it("notifies exactly the employees mentioned and refuses a mention of a client or a stranger", async () => {
  const bugId = await pickedBug("Mentions");
  const { POST } = await commentsRoute();

  const mentioned = await send(POST, "POST", "owner", {
    body: {
      body: `Please look @[${personaId("admin")}]`,
      visibility: "internal",
    },
    params: { bugId },
  });
  const notices = await notificationsFor(bugId);
  const mentions = notices.filter(({ type }) => type === "mention");
  const rows = await commentRows(bugId);
  const clientMention = await send(POST, "POST", "owner", {
    body: { body: `Hey @[${personaId("client")}]`, visibility: "public" },
    params: { bugId },
  });
  const stranger = await send(POST, "POST", "owner", {
    body: { body: `Ghost @[${randomUUID()}]`, visibility: "internal" },
    params: { bugId },
  });

  expect(mentioned.status).toBe(200);
  expect(mentions).toEqual([{ type: "mention", userId: personaId("admin") }]);
  expect(clientMention.status).toBe(422);
  expect(stranger.status).toBe(422);
  expect(await commentRows(bugId)).toEqual(rows);
  expect(await notificationsFor(bugId)).toEqual(notices);
});
