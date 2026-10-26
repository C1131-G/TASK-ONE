import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Schema } from "effect";

import {
  authPool,
  ids,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import {
  countRows,
  linkProjectToCompanies,
  send,
} from "./support/mobile-bugs-fixtures";

let nextTaskNumber = 100;

beforeAll(async () => {
  await setupHarness();
  await linkProjectToCompanies();
  await authPool.query(
    'UPDATE project SET "clientVisible" = true WHERE id = $1',
    [ids.projectId]
  );
  await authPool.query('UPDATE task SET "clientVisible" = true WHERE id = $1', [
    ids.taskId,
  ]);
});
afterAll(teardownHarness);

const listRoute = () => import("../../app/api/v1/portal/approvals/route");
const detailRoute = () =>
  import("../../app/api/v1/portal/approvals/[requestId]/route");
const decideRoute = () =>
  import("../../app/api/v1/portal/approvals/decide/route");

const seedTask = async (title: string): Promise<string> => {
  const taskId = randomUUID();
  nextTaskNumber += 1;
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, "clientVisible", "createdById") VALUES ($1, $2, $3, $4, true, $5)',
    [taskId, ids.projectId, nextTaskNumber, title, personaId("owner")]
  );
  return taskId;
};

interface SeedApprovalOptions {
  readonly companyId?: string;
  readonly message?: string;
  readonly requestedAt?: Date;
  readonly status?: "pending" | "approved" | "changes_requested" | "cancelled";
  readonly taskId: string;
  readonly title: string;
  readonly version?: number;
}

const seedApproval = async ({
  companyId = ids.clientCompanyId,
  message = "Please review this work.",
  requestedAt = new Date(),
  status = "pending",
  taskId,
  title,
  version = 1,
}: SeedApprovalOptions): Promise<string> => {
  const id = randomUUID();
  const decided = status === "approved" || status === "changes_requested";
  await authPool.query(
    `INSERT INTO approval_request (id, "projectId", "companyId", "taskId", "subjectKey", "subjectTitle", version, message, status, "requestedById", "requestedAt", "decidedById", "decidedAt", "decisionComment", "cancelledById", "cancelledAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
    [
      id,
      ids.projectId,
      companyId,
      taskId,
      `task:${taskId}`,
      title,
      version,
      message,
      status,
      personaId("owner"),
      requestedAt,
      decided ? personaId("client") : null,
      decided ? requestedAt : null,
      status === "changes_requested" ? "Please adjust the spacing." : null,
      status === "cancelled" ? personaId("owner") : null,
      status === "cancelled" ? requestedAt : null,
    ]
  );
  return id;
};

const attachFile = async (
  requestId: string,
  fileId: string = ids.fileId
): Promise<void> => {
  await authPool.query(
    'INSERT INTO approval_request_file (id, "requestId", "fileId") VALUES ($1, $2, $3)',
    [randomUUID(), requestId, fileId]
  );
};

const decisionBody = (
  requestId: string,
  decision: "approve" | "request_changes",
  comment = ""
) => ({ comment, decision, requestId });

// The app's own list contract, copied so drift fails a decode.
const ApprovalItemSchema = Schema.Struct({
  id: Schema.String,
  projectName: Schema.String,
  requestedBy: Schema.String,
  status: Schema.Literals(["pending", "approved", "rejected"]),
  title: Schema.String,
});
const ApprovalListSchema = Schema.Struct({
  items: Schema.Array(ApprovalItemSchema),
});

it("lists only the caller's company approvals with the app's statuses", async () => {
  const base = Date.now();
  const pendingId = await seedApproval({
    requestedAt: new Date(base - 3000),
    taskId: await seedTask("Pending approval"),
    title: "Pending approval",
  });
  const approvedId = await seedApproval({
    requestedAt: new Date(base - 2000),
    status: "approved",
    taskId: await seedTask("Approved approval"),
    title: "Approved approval",
  });
  const changesId = await seedApproval({
    requestedAt: new Date(base - 1000),
    status: "changes_requested",
    taskId: await seedTask("Changes approval"),
    title: "Changes approval",
  });
  const cancelledId = await seedApproval({
    status: "cancelled",
    taskId: await seedTask("Cancelled approval"),
    title: "Cancelled approval",
  });
  const otherCompanyId = await seedApproval({
    companyId: ids.otherClientCompanyId,
    taskId: await seedTask("Other company approval"),
    title: "Other company approval",
  });
  const { GET } = await listRoute();

  const reply = await send(GET, "GET", "client");

  expect(reply.status).toBe(200);
  expect(() =>
    Schema.decodeUnknownSync(ApprovalListSchema)(reply.body.data)
  ).not.toThrow();
  const items = reply.body.data.items as {
    id: string;
    projectName: string;
    requestedBy: string;
    status: string;
    title: string;
  }[];
  expect(items.map(({ id }) => id)).toEqual([pendingId, changesId, approvedId]);
  expect(items.filter(({ id }) => id === cancelledId)).toHaveLength(0);
  expect(items.filter(({ id }) => id === otherCompanyId)).toHaveLength(0);
  expect(items.find(({ id }) => id === pendingId)).toMatchObject({
    projectName: "Harness project",
    requestedBy: "Harness owner",
    status: "pending",
    title: "Pending approval",
  });
  expect(items.find(({ id }) => id === approvedId)?.status).toBe("approved");
  expect(items.find(({ id }) => id === changesId)?.status).toBe("rejected");

  const otherReply = await send(GET, "GET", "otherClient");
  expect(otherReply.status).toBe(200);
  const otherItems = otherReply.body.data.items as { id: string }[];
  expect(otherItems.map(({ id }) => id)).toContain(otherCompanyId);
  expect(otherItems.map(({ id }) => id)).not.toContain(pendingId);
});

it("returns one approval with files, history and the staff-only detail hidden", async () => {
  const taskId = await seedTask("Detail approval");
  const historyId = await seedApproval({
    requestedAt: new Date(Date.now() - 2000),
    status: "changes_requested",
    taskId,
    title: "Detail approval",
    version: 1,
  });
  const requestId = await seedApproval({
    message: "Second attempt, please review.",
    requestedAt: new Date(Date.now() - 1000),
    taskId,
    title: "Detail approval",
    version: 2,
  });
  await attachFile(requestId);
  const otherCompanyId = await seedApproval({
    companyId: ids.otherClientCompanyId,
    taskId: await seedTask("Other detail"),
    title: "Other detail",
  });
  const { GET } = await detailRoute();

  const reply = await send(GET, "GET", "client", {
    params: { requestId },
  });

  expect(reply.status).toBe(200);
  expect(reply.body.data).toMatchObject({
    canDecide: true,
    fileCount: 1,
    id: requestId,
    message: "Second attempt, please review.",
    status: "pending",
    subjectKind: "task",
    subjectTitle: "Detail approval",
    version: 2,
  });
  expect(reply.body.data.files).toEqual([
    expect.objectContaining({
      fileId: ids.fileId,
      fileName: "owned.txt",
      previewable: false,
    }),
  ]);
  expect(reply.body.data.history).toEqual([
    expect.objectContaining({
      id: historyId,
      status: "changes_requested",
      version: 1,
    }),
  ]);
  expect(JSON.stringify(reply.body.data)).not.toContain(personaId("owner"));

  const otherCompany = await send(GET, "GET", "client", {
    params: { requestId: otherCompanyId },
  });
  const staff = await send(GET, "GET", "owner", {
    params: { requestId },
  });
  const anonymous = await send(GET, "GET", "anonymous", {
    params: { requestId },
  });
  const revoked = await send(GET, "GET", "client", {
    params: { requestId },
    token: "revoked-token",
  });

  expect(otherCompany.status).toBe(404);
  expect(staff.status).toBe(403);
  expect(anonymous.status).toBe(401);
  expect(revoked.status).toBe(401);
});

it("approves, asks for changes and keeps a decision immutable", async () => {
  const approvedTask = await seedTask("Approve decision");
  const approvedId = await seedApproval({
    taskId: approvedTask,
    title: "Approve decision",
  });
  const changesTask = await seedTask("Changes decision");
  const changesId = await seedApproval({
    taskId: changesTask,
    title: "Changes decision",
  });
  const blankTask = await seedTask("Blank changes decision");
  const blankId = await seedApproval({
    taskId: blankTask,
    title: "Blank changes decision",
  });
  const { POST } = await decideRoute();

  const approved = await send(POST, "POST", "client", {
    body: decisionBody(approvedId, "approve"),
  });
  const changed = await send(POST, "POST", "coworker", {
    body: decisionBody(changesId, "request_changes", "Make it bigger."),
  });
  const blank = await send(POST, "POST", "coworker", {
    body: decisionBody(blankId, "request_changes"),
  });

  expect(approved.status).toBe(200);
  expect(approved.body.data).toEqual({
    requestId: approvedId,
    status: "approved",
  });
  expect(changed.status).toBe(200);
  expect(changed.body.data).toEqual({
    requestId: changesId,
    status: "changes_requested",
  });
  expect(blank.status).toBe(422);

  const decisions = await authPool.query<{
    decidedById: string | null;
    decisionComment: string | null;
    id: string;
    status: string;
  }>(
    'SELECT "decidedById", "decisionComment", id, status FROM approval_request WHERE id = ANY($1::uuid[]) ORDER BY id',
    [[approvedId, changesId, blankId]]
  );
  expect(decisions.rows.find(({ id }) => id === approvedId)).toMatchObject({
    decidedById: personaId("client"),
    status: "approved",
  });
  expect(decisions.rows.find(({ id }) => id === changesId)).toMatchObject({
    decidedById: personaId("coworker"),
    decisionComment: "Make it bigger.",
    status: "changes_requested",
  });
  expect(decisions.rows.find(({ id }) => id === blankId)?.status).toBe(
    "pending"
  );

  // Repeating the same person's decision is a no-op; anyone else is too late.
  const repeated = await send(POST, "POST", "client", {
    body: decisionBody(approvedId, "approve"),
  });
  const flipped = await send(POST, "POST", "coworker", {
    body: decisionBody(approvedId, "request_changes", "No."),
  });
  expect(repeated.status).toBe(200);
  expect(repeated.body.data.status).toBe("approved");
  expect(flipped.status).toBe(409);

  expect(
    await countRows("notification", '"userId" = $1 AND text LIKE $2', [
      personaId("owner"),
      "%approved Approve decision%",
    ])
  ).toBe(1);
  expect(
    await countRows("notification", '"userId" = $1 AND text LIKE $2', [
      personaId("owner"),
      "%requested changes to Changes decision%",
    ])
  ).toBe(1);
});

it("lets one racing decision win and replays a retried decision", async () => {
  const raceTask = await seedTask("Race decision");
  const raceId = await seedApproval({
    taskId: raceTask,
    title: "Race decision",
  });
  const retryTask = await seedTask("Retry decision");
  const retryId = await seedApproval({
    taskId: retryTask,
    title: "Retry decision",
  });
  const { POST } = await decideRoute();

  const replies = await Promise.all([
    send(POST, "POST", "client", {
      body: decisionBody(raceId, "approve"),
    }),
    send(POST, "POST", "coworker", {
      body: decisionBody(raceId, "request_changes", "Not yet."),
    }),
  ]);

  expect(replies.map((reply) => reply.status).toSorted()).toEqual([200, 409]);
  const raceStatus = await authPool.query<{ status: string }>(
    "SELECT status FROM approval_request WHERE id = $1",
    [raceId]
  );
  expect(["approved", "changes_requested"]).toContain(
    raceStatus.rows[0]?.status
  );

  const key = "portal-approval-decision-key";
  const first = await send(POST, "POST", "client", {
    body: decisionBody(retryId, "approve"),
    key,
  });
  const second = await send(POST, "POST", "client", {
    body: decisionBody(retryId, "approve"),
    key,
  });

  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(second.body.data).toEqual(first.body.data);
  expect(
    await countRows("notification", '"userId" = $1 AND text LIKE $2', [
      personaId("owner"),
      "%approved Retry decision%",
    ])
  ).toBe(1);
});

it("refuses another company, staff and unanswered tokens on a decision", async () => {
  const otherId = await seedApproval({
    companyId: ids.otherClientCompanyId,
    taskId: await seedTask("Other decision"),
    title: "Other decision",
  });
  const requestId = await seedApproval({
    taskId: await seedTask("Guarded decision"),
    title: "Guarded decision",
  });
  const { POST } = await decideRoute();

  const otherCompany = await send(POST, "POST", "client", {
    body: decisionBody(otherId, "approve"),
  });
  const staff = await send(POST, "POST", "owner", {
    body: decisionBody(requestId, "approve"),
  });
  const anonymous = await send(POST, "POST", "anonymous", {
    body: decisionBody(requestId, "approve"),
  });
  const revoked = await send(POST, "POST", "client", {
    body: decisionBody(requestId, "approve"),
    token: "revoked-token",
  });

  expect(otherCompany.status).toBe(404);
  expect(staff.status).toBe(403);
  expect(anonymous.status).toBe(401);
  expect(revoked.status).toBe(401);
  const status = await authPool.query<{ status: string }>(
    "SELECT status FROM approval_request WHERE id = ANY($1::uuid[])",
    [[otherId, requestId]]
  );
  expect(status.rows.map(({ status: value }) => value)).toEqual([
    "pending",
    "pending",
  ]);
});

it("answers the reads and the decision in the shapes the route list declares", async () => {
  const requestId = await seedApproval({
    taskId: await seedTask("Portal approval shape"),
    title: "Portal approval shape",
  });
  await attachFile(requestId);
  const { portalApprovalRoutes } =
    await import("../../src/mobile-api/routes-bugs");
  const { GET } = await listRoute();
  const { GET: GET_ONE } = await detailRoute();
  const { POST } = await decideRoute();

  const list = await send(GET, "GET", "client");
  const detail = await send(GET_ONE, "GET", "client", {
    params: { requestId },
  });
  const decided = await send(POST, "POST", "client", {
    body: decisionBody(requestId, "approve"),
  });

  expect(() =>
    Schema.decodeUnknownSync(portalApprovalRoutes.list.data)(list.body.data)
  ).not.toThrow();
  expect(() =>
    Schema.decodeUnknownSync(portalApprovalRoutes.detail.data)(detail.body.data)
  ).not.toThrow();
  expect(() =>
    Schema.decodeUnknownSync(portalApprovalRoutes.decide.data)(
      decided.body.data
    )
  ).not.toThrow();
});
