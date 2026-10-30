import { afterAll, beforeAll, expect, it } from "bun:test";

import {
  authPool,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import {
  bugRow,
  forceStatus,
  linkProjectToCompanies,
  reportBody,
  statusOf,
  versionOf,
  send,
} from "./support/mobile-bugs-fixtures";

beforeAll(async () => {
  await setupHarness();
  await linkProjectToCompanies();
});
afterAll(teardownHarness);

const submitRoute = () => import("../../apps/web/app/api/v1/portal/bugs/route");
const commentsRoute = () =>
  import("../../apps/web/app/api/v1/portal/bugs/[bugId]/comments/route");
const confirmRoute = () =>
  import("../../apps/web/app/api/v1/portal/bugs/[bugId]/confirm/route");
const reopenRoute = () =>
  import("../../apps/web/app/api/v1/portal/bugs/[bugId]/reopen/route");

const submit = async (
  persona: "client" | "otherClient" = "client",
  title = "Portal action"
): Promise<string> => {
  const { POST } = await submitRoute();
  const reply = await send(POST, "POST", persona, { body: reportBody(title) });
  return reply.body.data.bugId as string;
};

const awaitingClient = async (title: string): Promise<string> => {
  const bugId = await submit("client", title);
  await forceStatus(bugId, "awaiting_client", {
    awaitingClientSince: new Date(),
  });
  return bugId;
};

const commentCount = async (bugId: string): Promise<number> => {
  const result = await authPool.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM comment c JOIN bug_report b ON b."taskId" = c."taskId" WHERE b.id = $1',
    [bugId]
  );
  return Number(result.rows[0]?.count ?? 0);
};

it("lets a client answer an information request, which puts the bug back to work", async () => {
  const bugId = await submit("client", "Needs an answer");
  await forceStatus(bugId, "needs_info", {
    needsInfoSince: new Date(),
    statusBeforeNeedsInfo: "in_progress",
  });
  const { POST } = await commentsRoute();

  const reply = await send(POST, "POST", "client", {
    body: { body: "It happens on Safari." },
    params: { bugId },
  });

  expect(reply.status).toBe(200);
  expect(reply.body.data).toMatchObject({
    body: "It happens on Safari.",
    isMine: true,
    isTeam: false,
  });
  expect(await statusOf(bugId)).toBe("in_progress");
});

it("keeps another company's bug closed to a reply and leaves it unchanged", async () => {
  const bugId = await submit("otherClient", "Not for A");
  const before = await commentCount(bugId);
  const { POST } = await commentsRoute();

  const reply = await send(POST, "POST", "client", {
    body: { body: "Sneaking in" },
    params: { bugId },
  });

  expect(reply.status).toBe(404);
  expect(await commentCount(bugId)).toBe(before);
});

it("confirms a fix only when the bug awaits the client at the stated version", async () => {
  const bugId = await awaitingClient("Confirm me");
  const { version } = await bugRow(bugId);
  const { POST } = await confirmRoute();

  const stale = await send(POST, "POST", "client", {
    body: { expectedVersion: version - 1 },
    params: { bugId },
  });
  expect(stale.status).toBe(409);
  expect(await statusOf(bugId)).toBe("awaiting_client");

  const confirmed = await send(POST, "POST", "client", {
    body: { expectedVersion: version, satisfaction: "up" },
    params: { bugId },
  });
  expect(confirmed.status).toBe(200);
  expect(confirmed.body.data).toEqual({ bugId, version: version + 1 });
  expect(await statusOf(bugId)).toBe("closed");
});

it("refuses to confirm a bug that is not waiting on the client", async () => {
  const bugId = await submit("client", "Too early");
  const before = await bugRow(bugId);
  const { POST } = await confirmRoute();

  const reply = await send(POST, "POST", "client", {
    body: { expectedVersion: before.version },
    params: { bugId },
  });

  expect(reply.status).toBe(409);
  expect(await bugRow(bugId)).toEqual(before);
});

it("refuses a confirmation from another company without confirming the bug exists", async () => {
  const bugId = await awaitingClient("Not yours");
  const before = await bugRow(bugId);
  const { POST } = await confirmRoute();

  const reply = await send(POST, "POST", "otherClient", {
    body: { expectedVersion: before.version },
    params: { bugId },
  });

  expect(reply.status).toBe(404);
  expect(await bugRow(bugId)).toEqual(before);
});

it("requires a reason to reopen and then sends the bug back to the team", async () => {
  const bugId = await awaitingClient("Reopen me");
  const before = await bugRow(bugId);
  const { POST } = await reopenRoute();

  const blank = await send(POST, "POST", "client", {
    body: { expectedVersion: before.version, reason: "  " },
    params: { bugId },
  });
  expect(blank.status).toBe(422);
  expect(blank.body.error.fieldErrors).toHaveProperty("reason");
  expect(await bugRow(bugId)).toEqual(before);

  const reopened = await send(POST, "POST", "client", {
    body: { expectedVersion: before.version, reason: "Still broken on mobile" },
    params: { bugId },
  });
  expect(reopened.status).toBe(200);
  expect(await statusOf(bugId)).toBe("reported");
});

it("refuses to reopen a bug that is not waiting on the client", async () => {
  const bugId = await submit("client", "Cannot reopen");
  const before = await bugRow(bugId);
  const { POST } = await reopenRoute();

  const reply = await send(POST, "POST", "client", {
    body: { expectedVersion: before.version, reason: "Nope" },
    params: { bugId },
  });

  expect(reply.status).toBe(409);
  expect(await bugRow(bugId)).toEqual(before);
});

it("applies a retried confirmation once", async () => {
  const bugId = await awaitingClient("Retry confirm");
  const { version } = await bugRow(bugId);
  const { POST } = await confirmRoute();
  const key = "portal-confirm-retry-key";

  const first = await send(POST, "POST", "client", {
    body: { expectedVersion: version },
    key,
    params: { bugId },
  });
  const second = await send(POST, "POST", "client", {
    body: { expectedVersion: version },
    key,
    params: { bugId },
  });

  expect(second.status).toBe(200);
  expect(second.body.data).toEqual(first.body.data);
  expect(await versionOf(bugId)).toBe(version + 1);
});
