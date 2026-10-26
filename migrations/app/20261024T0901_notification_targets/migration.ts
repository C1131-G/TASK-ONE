#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/25ecf1b0c580b4b20b04b7c75a1bdad389a9c26ac3caa5c659e76e4179f9692f/contract';
import startContract from '../../snapshots/25ecf1b0c580b4b20b04b7c75a1bdad389a9c26ac3caa5c659e76e4179f9692f/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/fbda034d9cd4349b3f088c05c77ccdc8a435640a7f1ef609b7b893adbb931597/contract';
import endContract from '../../snapshots/fbda034d9cd4349b3f088c05c77ccdc8a435640a7f1ef609b7b893adbb931597/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, rawSql } from '@prisma/orm-postgres/migration';

// Gives every existing notification the target it can be tied to: a bug when
// its task is a bug report, else its task, and an approval request matched the
// way the portal always matched it (same project, requester and instant, and
// the exact request text). Anything that matches nothing keeps no target.
const backfillSteps = [
  {
    description: 'point notifications about bug tasks at their bug',
    sql: `UPDATE "public"."notification" AS n SET "targetType" = 'bug', "targetId" = b."id" FROM "public"."bug_report" AS b WHERE n."targetType" IS NULL AND n."taskId" = b."taskId"`,
  },
  {
    description: 'point the remaining task notifications at their task',
    sql: `UPDATE "public"."notification" SET "targetType" = 'task', "targetId" = "taskId" WHERE "targetType" IS NULL AND "taskId" IS NOT NULL`,
  },
  {
    description: 'point approval request notifications at their request',
    sql: `UPDATE "public"."notification" AS n SET "targetType" = 'approval', "targetId" = r."id" FROM "public"."approval_request" AS r, "public"."user" AS u WHERE n."targetType" IS NULL AND n."taskId" IS NULL AND n."type" = 'status' AND n."projectId" = r."projectId" AND n."createdAt" = r."requestedAt" AND n."actorId" = r."requestedById" AND u."id" = n."userId" AND u."clientCompanyId" = r."companyId" AND n."text" = CASE WHEN r."version" > 1 THEN 'Approval requested again: ' ELSE 'Approval requested: ' END || r."subjectTitle"`,
  },
];

const backfillTargets = rawSql({
  id: 'data.notification.backfillTargets',
  label: 'Backfill notification targets from existing rows',
  operationClass: 'data',
  target: { id: 'postgres' },
  precheck: [],
  execute: backfillSteps,
  postcheck: [
    {
      description: 'verify no task notification was left without a target',
      sql: `SELECT NOT EXISTS (SELECT 1 FROM "public"."notification" WHERE "taskId" IS NOT NULL AND "targetType" IS NULL) AS "result"`,
    },
  ],
});

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'notification',
        column: col('targetId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'notification',
        column: col('targetType', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      backfillTargets,
      this.addCheckConstraint({
        schema: 'public',
        table: 'notification',
        constraint: 'notification_target_valid_74444e8d',
        expression: `("targetType" IS NULL) = ("targetId" IS NULL) AND ("targetType" IS NULL OR "targetType" IN ('task', 'bug', 'approval'))`,
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
