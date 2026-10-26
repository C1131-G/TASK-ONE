import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { authPool, ids, personaId } from "./support/action-harness";
import {
  installHooks,
  state,
  submit,
} from "./support/client-lifecycle-fixtures";
import { seedNotification } from "./support/mobile-notifications-fixtures";

installHooks();

interface MigrationOperation {
  readonly execute: readonly { readonly sql: string }[];
  readonly id: string;
}

// The statements the migration runs on rows that predate notification targets.
const backfillStatements = (): readonly string[] => {
  const operations = JSON.parse(
    readFileSync(
      new URL(
        "../../migrations/app/20261024T0901_notification_targets/ops.json",
        import.meta.url
      ),
      "utf-8"
    )
  ) as MigrationOperation[];
  const backfill = operations.find(
    ({ id }) => id === "data.notification.backfillTargets"
  );
  return backfill?.execute.map(({ sql }) => sql) ?? [];
};

const runBackfill = async (): Promise<void> => {
  for (const sql of backfillStatements()) {
    // oxlint-disable-next-line no-await-in-loop
    await authPool.query(sql);
  }
};

const targetOf = async (id: string) => {
  const result = await authPool.query<{
    targetId: string | null;
    targetType: string | null;
  }>('SELECT "targetId", "targetType" FROM notification WHERE id = $1', [id]);
  return result.rows[0];
};

it("gives notifications that predate targets the bug, task or approval they were about", async () => {
  const userId = personaId("client");
  const bugId = await submit("Legacy bug");
  const { taskId: bugTaskId } = await state(bugId);
  const requestedAt = new Date(Date.now() - 60_000);
  const requestId = randomUUID();
  await authPool.query(
    'INSERT INTO approval_request (id, "projectId", "companyId", "taskId", "subjectKey", "subjectTitle", version, message, "requestedById", "requestedAt") VALUES ($1, $2, $3, $4, $5, \'Legacy logo\', 1, \'Review please\', $6, $7)',
    [
      requestId,
      ids.projectId,
      ids.clientCompanyId,
      ids.taskId,
      `task:${ids.taskId}`,
      personaId("owner"),
      requestedAt,
    ]
  );
  const onBug = await seedNotification({ taskId: bugTaskId, userId });
  const onTask = await seedNotification({ taskId: ids.taskId, userId });
  const onApproval = await seedNotification({
    actorId: personaId("owner"),
    createdAt: requestedAt,
    projectId: ids.projectId,
    text: "Approval requested: Legacy logo",
    type: "status",
    userId,
  });
  const onNothing = await seedNotification({ userId });
  const ownRows = [onBug, onTask, onApproval, onNothing];
  await authPool.query(
    'UPDATE notification SET "targetType" = NULL, "targetId" = NULL WHERE id = ANY($1::uuid[])',
    [ownRows]
  );

  await runBackfill();
  await runBackfill();

  expect(await targetOf(onBug)).toEqual({ targetId: bugId, targetType: "bug" });
  expect(await targetOf(onTask)).toEqual({
    targetId: ids.taskId,
    targetType: "task",
  });
  expect(await targetOf(onApproval)).toEqual({
    targetId: requestId,
    targetType: "approval",
  });
  expect(await targetOf(onNothing)).toEqual({
    targetId: null,
    targetType: null,
  });
});
