import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import {
  WorkManagement,
  WorkManagementLive,
} from "../../src/server/work/work-management";
import {
  authPool,
  callAs,
  ids,
  nextKey,
  personaId,
} from "./support/action-harness";
import {
  installHooks,
  pick,
  state,
  submit,
} from "./support/client-lifecycle-fixtures";

const comments = await import("../../features/tasks/actions/tasks-comments");

installHooks();

interface Target {
  targetId: string | null;
  targetType: string | null;
  snippet: string | null;
  text: string;
  type: string;
}

const targetsFor = async (userId: string, taskId: string) => {
  const rows = await authPool.query<Target>(
    'SELECT "targetId", "targetType", snippet, text, type FROM notification WHERE "userId" = $1 AND "taskId" = $2 ORDER BY "createdAt", id',
    [userId, taskId]
  );
  return rows.rows;
};

it("records the task as the target of an assignment notification", async () => {
  const created = await Effect.runPromise(
    Effect.provide(
      Effect.gen(function* createAssigned() {
        const work = yield* WorkManagement;
        return yield* work.createTask(personaId("owner"), {
          assigneeIds: [personaId("outsider")],
          description: null,
          dueDate: null,
          priority: "medium",
          projectId: ids.projectId,
          title: `Assigned ${randomUUID().slice(0, 6)}`,
        });
      }),
      WorkManagementLive
    )
  );

  const rows = await targetsFor(personaId("outsider"), created.id);

  expect(rows).toEqual([
    {
      snippet: expect.any(String),
      targetId: created.id,
      targetType: "task",
      text: expect.any(String),
      type: "assignment",
    },
  ]);
});

it("records the bug as the target of a new client bug notification for its handler", async () => {
  const bugId = await submit("Target bug");
  const { taskId } = await state(bugId);

  const rows = await targetsFor(personaId("owner"), taskId);

  expect(rows.map(({ type }) => type)).toEqual(["client_bug"]);
  expect(rows[0]).toMatchObject({ targetId: bugId, targetType: "bug" });
});

it("records the bug as the target of a public reply to the client, and tells the client nothing of an internal note", async () => {
  const bugId = await submit("Reply bug");
  const { taskId } = await state(bugId);
  await pick(bugId);
  const internal = await callAs("owner", comments.createCommentAction, {
    body: "Internal only: reporter is hard to please",
    idempotencyKey: nextKey(),
    taskId,
    visibility: "internal",
  });
  const publicReply = await callAs("owner", comments.createCommentAction, {
    body: "We are on it",
    idempotencyKey: nextKey(),
    taskId,
    visibility: "public",
  });

  const rows = await targetsFor(personaId("client"), taskId);

  expect(internal.ok).toBe(true);
  expect(publicReply.ok).toBe(true);
  expect(rows.map(({ snippet }) => snippet)).toEqual(["We are on it"]);
  expect(rows[0]).toMatchObject({ targetId: bugId, targetType: "bug" });
});

it("records the approval request as the target of the notice to every client of the company", async () => {
  const staffApprovals =
    await import("../../features/approvals/approval-actions");
  const sharedTaskId = randomUUID();
  await authPool.query(
    'UPDATE project SET "clientVisible" = true WHERE id = $1',
    [ids.projectId]
  );
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, "clientVisible", "createdById") VALUES ($1, $2, 900, $3, true, $4)',
    [sharedTaskId, ids.projectId, "Shared deliverable", personaId("owner")]
  );

  const fileId = randomUUID();
  await authPool.query(
    'INSERT INTO file_asset (id, "projectId", "taskId", "uploadedById", "originalName", "storageKey", "contentType", "sizeBytes") VALUES ($1, $2, $3, $4, \'deliverable.pdf\', $5, \'application/pdf\', 10)',
    [
      fileId,
      ids.projectId,
      sharedTaskId,
      personaId("owner"),
      `approvals/${fileId}/deliverable.pdf`,
    ]
  );

  const requested = await callAs(
    "owner",
    staffApprovals.requestApprovalAction,
    {
      companyId: ids.clientCompanyId,
      fileIds: [fileId],
      idempotencyKey: nextKey(),
      message: "Please review.",
      taskId: sharedTaskId,
    }
  );
  if (!requested.ok) {
    throw new Error(requested.error.message);
  }
  const requestId = (requested.data as { id: string }).id;
  const rows = await authPool.query<{ targetId: string; targetType: string }>(
    'SELECT "targetId", "targetType" FROM notification WHERE "userId" = ANY($1::text[]) AND text LIKE \'Approval requested%\'',
    [[personaId("client"), personaId("coworker")]]
  );

  expect(rows.rows).toEqual([
    { targetId: requestId, targetType: "approval" },
    { targetId: requestId, targetType: "approval" },
  ]);
});
