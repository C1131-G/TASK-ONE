import { afterAll, beforeAll, beforeEach, expect, it } from "bun:test";
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

const otherFileId = randomUUID();
const otherTaskId = randomUUID();

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
  await authPool.query(
    'INSERT INTO task_assignee ("taskId", "userId", "assignedById") VALUES ($1, $2, $2)',
    [ids.taskId, personaId("owner")]
  );
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, "clientVisible", "createdById") VALUES ($1, $2, 10, $3, true, $4)',
    [otherTaskId, ids.projectId, "Other task", personaId("owner")]
  );
  await authPool.query(
    'INSERT INTO file_asset (id, "projectId", "taskId", "uploadedById", "originalName", "storageKey", "contentType", "sizeBytes") VALUES ($1, $2, $3, $4, $5, $6, \'application/pdf\', 10)',
    [
      otherFileId,
      ids.projectId,
      otherTaskId,
      personaId("owner"),
      "other.pdf",
      `approvals/${otherFileId}/other.pdf`,
    ]
  );
});
beforeEach(async () => {
  await authPool.query('DELETE FROM approval_request WHERE "projectId" = $1', [
    ids.projectId,
  ]);
  await authPool.query(
    'DELETE FROM notification WHERE "userId" = ANY($1::text[])',
    [[personaId("owner"), personaId("client"), personaId("coworker")]]
  );
  await authPool.query('UPDATE task SET "clientVisible" = true WHERE id = $1', [
    ids.taskId,
  ]);
});
afterAll(teardownHarness);

const approvalsRoute = () =>
  import("../../apps/web/app/api/v1/workspace/approvals/route");

const requestBody = (overrides: Record<string, unknown> = {}) => ({
  companyId: ids.clientCompanyId,
  fileIds: [ids.fileId],
  message: "Please review the logo concepts.",
  taskId: ids.taskId,
  ...overrides,
});

interface ApprovalRow {
  readonly companyId: string;
  readonly id: string;
  readonly requestedById: string;
  readonly status: string;
  readonly subjectTitle: string;
  readonly taskId: string | null;
  readonly version: number;
}

const approvalsOf = async (): Promise<ApprovalRow[]> => {
  const result = await authPool.query<ApprovalRow>(
    `SELECT "companyId", id, "requestedById", status, "subjectTitle", "taskId", version
     FROM approval_request
     WHERE "projectId" = $1
     ORDER BY version`,
    [ids.projectId]
  );
  return result.rows;
};

it("lets an owner request a client approval for a shared task", async () => {
  const { POST } = await approvalsRoute();

  const reply = await send(POST, "POST", "owner", { body: requestBody() });

  expect(reply.status).toBe(200);
  expect(reply.body.data).toMatchObject({ version: 1 });
  expect(reply.body.data.id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u
  );
  const [approval] = await approvalsOf();
  expect(approval).toMatchObject({
    companyId: ids.clientCompanyId,
    requestedById: personaId("owner"),
    status: "pending",
    subjectTitle: "Owned task",
    taskId: ids.taskId,
    version: 1,
  });
  expect(
    await countRows(
      "approval_request_file",
      '"requestId" = $1 AND "fileId" = $2',
      [approval?.id, ids.fileId]
    )
  ).toBe(1);
  expect(
    await countRows(
      "notification",
      "\"userId\" = $1 AND text LIKE 'Approval requested%'",
      [personaId("client")]
    )
  ).toBe(1);
});

it("refuses approvals for unshared work, foreign files or no files", async () => {
  const { POST } = await approvalsRoute();
  await authPool.query(
    'UPDATE task SET "clientVisible" = false WHERE id = $1',
    [ids.taskId]
  );

  const unshared = await send(POST, "POST", "owner", {
    body: requestBody(),
  });
  await authPool.query('UPDATE task SET "clientVisible" = true WHERE id = $1', [
    ids.taskId,
  ]);
  const foreignFile = await send(POST, "POST", "owner", {
    body: requestBody({ fileIds: [otherFileId] }),
  });
  const noFiles = await send(POST, "POST", "owner", {
    body: requestBody({ fileIds: [] }),
  });
  const blankMessage = await send(POST, "POST", "owner", {
    body: requestBody({ message: "   " }),
  });
  const unknownCompany = await send(POST, "POST", "owner", {
    body: requestBody({ companyId: randomUUID() }),
  });

  expect(unshared.status).toBe(422);
  expect(foreignFile.status).toBe(422);
  expect(noFiles.status).toBe(422);
  expect(blankMessage.status).toBe(422);
  expect(unknownCompany.status).toBe(422);
  expect(await approvalsOf()).toHaveLength(0);
});

it("refuses an archived task, an outsider, a client and anonymous callers", async () => {
  const { POST } = await approvalsRoute();

  const archived = await send(POST, "POST", "owner", {
    body: requestBody({ taskId: ids.archivedTaskId }),
  });
  const outsider = await send(POST, "POST", "outsider", {
    body: requestBody(),
  });
  const client = await send(POST, "POST", "client", {
    body: requestBody(),
  });
  const anonymous = await send(POST, "POST", "anonymous", {
    body: requestBody(),
  });
  const revoked = await send(POST, "POST", "owner", {
    body: requestBody(),
    token: "revoked-token",
  });

  expect(archived.status).toBe(403);
  expect(outsider.status).toBe(403);
  expect(client.status).toBe(403);
  expect(anonymous.status).toBe(401);
  expect(revoked.status).toBe(401);
  expect(await approvalsOf()).toHaveLength(0);
});

it("refuses a second pending request and replays the same key", async () => {
  const { POST } = await approvalsRoute();
  const key = "staff-approval-request-retry-key";

  const first = await send(POST, "POST", "owner", {
    body: requestBody(),
    key,
  });
  const afterFirst = await approvalsOf();
  const retried = await send(POST, "POST", "owner", {
    body: requestBody(),
    key,
  });
  const duplicate = await send(POST, "POST", "owner", {
    body: requestBody(),
  });

  expect(first.status).toBe(200);
  expect(retried.status).toBe(200);
  expect(retried.body.data).toEqual(first.body.data);
  expect(duplicate.status).toBe(409);
  expect(await approvalsOf()).toEqual(afterFirst);
  expect(afterFirst).toHaveLength(1);
});

it("answers the request in the shape the route list declares", async () => {
  const { POST } = await approvalsRoute();
  const { workspaceApprovalRoute } =
    await import("../../src/mobile-api/routes-bugs");

  const reply = await send(POST, "POST", "owner", { body: requestBody() });

  expect(() =>
    Schema.decodeUnknownSync(workspaceApprovalRoute.data)(reply.body.data)
  ).not.toThrow();
});
