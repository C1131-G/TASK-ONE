import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { pageOf } from "../../src/server/api/paging";
import {
  authPool,
  ids,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import {
  bugRow,
  linkProjectToCompanies,
  reportBody,
  send,
} from "./support/mobile-bugs-fixtures";

beforeAll(async () => {
  await setupHarness();
  await linkProjectToCompanies();
  // The client only sees approvals on work shared with them.
  await authPool.query(
    'UPDATE project SET "clientVisible" = true WHERE id = $1',
    [ids.projectId]
  );
});
afterAll(teardownHarness);

interface Row {
  readonly id: string;
}

const rows = (count: number): Row[] =>
  Array.from({ length: count }, (_, index) => ({ id: `row-${index}` }));

const page = (
  items: readonly Row[],
  query: { cursor?: string; limit?: number }
) => Effect.runPromise(pageOf(items, ({ id }) => id, query));

it("returns the first page and a cursor to the rest", async () => {
  const first = await page(rows(5), { limit: 2 });

  expect(first.items.map(({ id }) => id)).toEqual(["row-0", "row-1"]);
  expect(first.nextCursor).not.toBeNull();
});

it("walks every row once, in order, and ends with no cursor", async () => {
  const all = rows(7);
  const seen: string[] = [];
  let cursor: string | undefined;
  let pages = 0;
  do {
    // eslint-disable-next-line no-await-in-loop
    const next = await page(all, { limit: 3, ...(cursor ? { cursor } : {}) });
    seen.push(...next.items.map(({ id }) => id));
    cursor = next.nextCursor ?? undefined;
    pages += 1;
  } while (cursor);

  expect(seen).toEqual(all.map(({ id }) => id));
  expect(pages).toBe(3);
});

it("gives no cursor when everything fits on one page", async () => {
  const only = await page(rows(3), { limit: 3 });

  expect(only.items).toHaveLength(3);
  expect(only.nextCursor).toBeNull();
});

it("defaults to 50 rows", async () => {
  const first = await page(rows(80), {});

  expect(first.items).toHaveLength(50);
  expect(first.nextCursor).not.toBeNull();
});

it("refuses a cursor that does not name a row of this list", async () => {
  await expect(page(rows(5), { cursor: "bm90LWEtcm93" })).rejects.toMatchObject(
    { code: "VALIDATION_FAILED" }
  );
});

// --- the routes ---

const submitRoute = () => import("../../apps/web/app/api/v1/portal/bugs/route");
const inboxRoute = () =>
  import("../../apps/web/app/api/v1/workspace/bug-approvals/route");
const portalApprovalsRoute = () =>
  import("../../apps/web/app/api/v1/portal/approvals/route");

const seedBugApproval = async (
  title: string,
  minutesAgo: number
): Promise<string> => {
  const { POST } = await submitRoute();
  const reply = await send(POST, "POST", "client", { body: reportBody(title) });
  const bugId = reply.body.data.bugId as string;
  const { taskId } = await bugRow(bugId);
  const attemptId = randomUUID();
  const approvalId = randomUUID();
  await authPool.query(
    'INSERT INTO bug_fix_attempt (id, "bugReportId", "authorId", "rootCause", "fixSummary", "verificationSteps") VALUES ($1, $2, $3, $4, $5, $6)',
    [attemptId, bugId, personaId("owner"), "Cause", "Fix", ["Step"]]
  );
  await authPool.query(
    'INSERT INTO bug_approval (id, "bugReportId", "fixAttemptId", "submittedById", status, snapshot, "submittedAt") VALUES ($1, $2, $3, $4, \'pending\', $5, $6)',
    [
      approvalId,
      bugId,
      attemptId,
      personaId("owner"),
      JSON.stringify({ taskId }),
      new Date(Date.now() - minutesAgo * 60_000),
    ]
  );
  return approvalId;
};

const walk = async (
  route: () => Promise<{ GET: Parameters<typeof send>[0] }>,
  as: "admin" | "client",
  limit: number
): Promise<string[]> => {
  const { GET } = await route();
  const seen: string[] = [];
  let cursor: string | undefined;
  do {
    // eslint-disable-next-line no-await-in-loop
    const reply = await send(GET, "GET", as, {
      query: { limit: String(limit), ...(cursor ? { cursor } : {}) },
    });
    expect(reply.status).toBe(200);
    seen.push(
      ...(reply.body.data.items as Row[]).map(({ id }: Row): string => id)
    );
    cursor = (reply.body.data.nextCursor as string | null) ?? undefined;
  } while (cursor);
  return seen;
};

it("pages the bug-approvals inbox and returns what one big read returns", async () => {
  for (let index = 0; index < 5; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    await seedBugApproval(`Paged fix ${index}`, 5 - index);
  }

  const everything = await walk(inboxRoute, "admin", 100);
  const paged = await walk(inboxRoute, "admin", 2);

  expect(everything.length).toBeGreaterThanOrEqual(5);
  expect(paged).toEqual(everything);
  expect(new Set(paged).size).toBe(paged.length);
});

it("pages the client's approvals and returns what one big read returns", async () => {
  for (let index = 0; index < 5; index += 1) {
    const taskId = randomUUID();
    const requestId = randomUUID();
    // eslint-disable-next-line no-await-in-loop
    await authPool.query(
      'INSERT INTO task (id, "projectId", "projectTaskNumber", title, "clientVisible", "createdById") VALUES ($1, $2, $3, $4, true, $5)',
      [
        taskId,
        ids.projectId,
        700 + index,
        `Paged approval ${index}`,
        personaId("owner"),
      ]
    );
    // eslint-disable-next-line no-await-in-loop
    await authPool.query(
      `INSERT INTO approval_request (id, "projectId", "companyId", "taskId", "subjectKey", "subjectTitle", version, message, status, "requestedById", "requestedAt")
       VALUES ($1, $2, $3, $4, $5, $6, 1, 'Please review.', 'pending', $7, now() - make_interval(mins => $8))`,
      [
        requestId,
        ids.projectId,
        ids.clientCompanyId,
        taskId,
        `task:${taskId}`,
        `Paged approval ${index}`,
        personaId("owner"),
        index,
      ]
    );
  }

  const everything = await walk(portalApprovalsRoute, "client", 100);
  const paged = await walk(portalApprovalsRoute, "client", 2);

  expect(everything.length).toBeGreaterThanOrEqual(5);
  expect(paged).toEqual(everything);
  expect(new Set(paged).size).toBe(paged.length);
});

it("refuses a limit outside 1 to 100", async () => {
  const { GET } = await inboxRoute();

  const zero = await send(GET, "GET", "admin", { query: { limit: "0" } });
  const huge = await send(GET, "GET", "admin", { query: { limit: "101" } });

  expect([zero.status, huge.status]).toEqual([422, 422]);
});
