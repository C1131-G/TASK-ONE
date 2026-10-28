#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/61afe3ffbbbe6842c629550003404982fb79f698f88a35dac7328c3ef16d27b6/contract';
import endContract from '../../snapshots/61afe3ffbbbe6842c629550003404982fb79f698f88a35dac7328c3ef16d27b6/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/fbda034d9cd4349b3f088c05c77ccdc8a435640a7f1ef609b7b893adbb931597/contract';
import startContract from '../../snapshots/fbda034d9cd4349b3f088c05c77ccdc8a435640a7f1ef609b7b893adbb931597/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, rawSql } from '@prisma/orm-postgres/migration';

// The application already keeps these pairs in step (archiving sets both task
// columns, completing a subtask sets the flag and the time, verifying a fix
// sets outcome, person and time). This stops the migration with a clear message
// when an old row breaks a rule, instead of failing inside the constraint.
const checkExistingRows = rawSql({
  id: 'data.audit_constraints.checkExistingRows',
  label: 'Check that no existing row breaks the new constraints',
  operationClass: 'data',
  target: { id: 'postgres' },
  precheck: [
    {
      description: 'no task has only one of archivedAt and archivedById',
      sql: `SELECT NOT EXISTS (SELECT 1 FROM "public"."task" WHERE ("archivedAt" IS NULL) <> ("archivedById" IS NULL)) AS "result"`,
    },
    {
      description: 'no subtask has a completed flag that disagrees with completedAt',
      sql: `SELECT NOT EXISTS (SELECT 1 FROM "public"."task_subtask" WHERE "isCompleted" <> ("completedAt" IS NOT NULL)) AS "result"`,
    },
    {
      description: 'no fix attempt has a partly recorded verification',
      sql: `SELECT NOT EXISTS (SELECT 1 FROM "public"."bug_fix_attempt" WHERE ("verificationOutcome" IS NULL) <> ("verifiedById" IS NULL) OR ("verificationOutcome" IS NULL) <> ("verifiedAt" IS NULL)) AS "result"`,
    },
  ],
  execute: [{ description: 'nothing to change before the constraints', sql: 'SELECT 1' }],
  postcheck: [],
});

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      checkExistingRows,
      this.addCheckConstraint({
        schema: 'public',
        table: 'bug_fix_attempt',
        constraint: 'bug_fix_attempt_verification_complete_c743879b',
        expression:
          '("verificationOutcome" IS NULL) = ("verifiedById" IS NULL) AND ("verificationOutcome" IS NULL) = ("verifiedAt" IS NULL)',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'task',
        constraint: 'task_archive_pair_dc6ab2b4',
        expression: '("archivedAt" IS NULL) = ("archivedById" IS NULL)',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'task_subtask',
        constraint: 'task_subtask_completion_pair_be76e2dd',
        expression: '"isCompleted" = ("completedAt" IS NOT NULL)',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
