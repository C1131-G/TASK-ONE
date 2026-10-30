import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Schema } from "effect";

import {
  authPool,
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
});
afterAll(teardownHarness);

const submitRoute = () => import("../../apps/web/app/api/v1/portal/bugs/route");
const inboxRoute = () =>
  import("../../apps/web/app/api/v1/workspace/bug-approvals/route");

const submit = async (title: string): Promise<string> => {
  const { POST } = await submitRoute();
  const reply = await send(POST, "POST", "client", {
    body: reportBody(title),
  });
  if (reply.status !== 200) {
    throw new Error(JSON.stringify(reply.body));
  }
  return reply.body.data.bugId as string;
};

// Produces the approval row an earlier workflow step would have written, with
// the decision fields its check constraint requires.
const seedApproval = async (
  title: string,
  status: "pending" | "approved" | "rejected",
  minutesAgo: number
): Promise<string> => {
  const bugId = await submit(title);
  const { taskId } = await bugRow(bugId);
  const attemptId = randomUUID();
  const approvalId = randomUUID();
  const submittedAt = new Date(Date.now() - minutesAgo * 60_000);
  const decidedAt =
    status === "pending" ? null : new Date(submittedAt.getTime() + 1000);
  await authPool.query(
    'INSERT INTO bug_fix_attempt (id, "bugReportId", "authorId", "rootCause", "fixSummary", "verificationSteps") VALUES ($1, $2, $3, $4, $5, $6)',
    [
      attemptId,
      bugId,
      personaId("owner"),
      "Root cause",
      "Fix summary",
      ["Step"],
    ]
  );
  await authPool.query(
    'INSERT INTO bug_approval (id, "bugReportId", "fixAttemptId", "submittedById", "decidedById", status, snapshot, "rejectionReason", "submittedAt", "decidedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
    [
      approvalId,
      bugId,
      attemptId,
      personaId("owner"),
      status === "pending" ? null : personaId("admin"),
      status,
      JSON.stringify({ taskId }),
      status === "rejected" ? "Not ready to ship" : null,
      submittedAt,
      decidedAt,
    ]
  );
  return approvalId;
};

it("lists every approval with its bug, project, reporter and status, newest first", async () => {
  const rejected = await seedApproval("Rejected fix", "rejected", 3);
  const approved = await seedApproval("Approved fix", "approved", 2);
  const pending = await seedApproval("Pending fix", "pending", 1);
  const { GET } = await inboxRoute();

  const reply = await send(GET, "GET", "admin");

  expect(reply.status).toBe(200);
  expect(reply.body.data.items.map(({ id }: { id: string }) => id)).toEqual([
    pending,
    approved,
    rejected,
  ]);
  expect(reply.body.data.items[0]).toEqual({
    bugTitle: "Pending fix",
    id: pending,
    projectName: "Harness project",
    reportedBy: "Harness client",
    status: "pending",
  });
  expect(
    reply.body.data.items.map(({ status }: { status: string }) => status)
  ).toEqual(["pending", "approved", "rejected"]);
});

it("refuses employees, clients and signed-out callers", async () => {
  const { GET } = await inboxRoute();

  const employee = await send(GET, "GET", "owner");
  const client = await send(GET, "GET", "client");
  const anonymous = await send(GET, "GET", "anonymous");
  const revoked = await send(GET, "GET", "admin", { token: "revoked-token" });

  expect(employee.status).toBe(403);
  expect(client.status).toBe(403);
  expect(anonymous.status).toBe(401);
  expect(revoked.status).toBe(401);
});

it("answers in exactly the shape the route list declares", async () => {
  const { GET } = await inboxRoute();
  const { staffBugApprovalInboxRoute } =
    await import("../../src/mobile-api/routes-bugs");

  const reply = await send(GET, "GET", "admin");

  expect(() =>
    Schema.decodeUnknownSync(staffBugApprovalInboxRoute.data)(reply.body.data)
  ).not.toThrow();
});
