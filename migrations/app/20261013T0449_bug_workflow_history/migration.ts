#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/6bab5524fa68e874d5dc8f096ee95993ad65cd59501e79b4f3fb07b94eb6d6e0/contract';
import startContract from '../../snapshots/6bab5524fa68e874d5dc8f096ee95993ad65cd59501e79b4f3fb07b94eb6d6e0/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/d970dbfec62663aa9e785a42b265a307512f5a753698f0e8d7505e55fe4d2bea/contract';
import endContract from '../../snapshots/d970dbfec62663aa9e785a42b265a307512f5a753698f0e8d7505e55fe4d2bea/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'bug_approval',
        columns: [
          col('bugReportId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('comment', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('decidedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-date@1' } }),
          col('decidedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('fixAttemptId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('rejectionReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('snapshot', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('pending'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('submittedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('submittedById', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'bug_approval_decision_valid_7533cc14',
            `("status" = 'pending' AND "decidedById" IS NULL AND "decidedAt" IS NULL AND "rejectionReason" IS NULL) OR ("status" = 'approved' AND "decidedById" IS NOT NULL AND "decidedAt" IS NOT NULL AND "rejectionReason" IS NULL) OR ("status" = 'rejected' AND "decidedById" IS NOT NULL AND "decidedAt" IS NOT NULL AND length(trim("rejectionReason")) > 0)`,
          ),
          checkExpression(
            'bug_approval_status_check_19a2b525',
            `"status" IN ('pending', 'approved', 'rejected')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'bug_evidence',
        columns: [
          col('bugReportId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('caption', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('externalUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('fileAssetId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('fixAttemptId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('kind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('uploadedById', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'bug_evidence_kind_check_7fe3d18b',
            `"kind" IN ('other', 'before', 'after')`,
          ),
          checkExpression(
            'bug_evidence_source_xor_ad21740a',
            '("fileAssetId" IS NOT NULL AND "externalUrl" IS NULL) OR ("fileAssetId" IS NULL AND "externalUrl" IS NOT NULL)',
          ),
          checkExpression(
            'bug_evidence_url_https_e620534a',
            `"externalUrl" IS NULL OR "externalUrl" ~ '^https://[^[:space:]]+$'`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'bug_fix_attempt',
        columns: [
          col('affectedVersion', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('authorId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('bugReportId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('commitUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('fixSummary', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('fixedVersion', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('pullRequestUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('rootCause', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('verificationNotes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('verificationOutcome', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('verificationSteps', 'text[]', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1', many: true },
          }),
          col('verifiedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-date@1' } }),
          col('verifiedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('version', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'bug_fix_attempt_verificationOutcome_check_67654efb',
            `"verificationOutcome" IN ('passed', 'failed')`,
          ),
          checkExpression(
            'bug_fix_attempt_verificationSteps_elem_not_null_34f1ffc0',
            'array_position("verificationSteps", NULL) IS NULL',
          ),
          checkExpression('bug_fix_attempt_version_positive_efca705d', '"version" > 0'),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'bug_relation',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('createdById', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('fromBugReportId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('toBugReportId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('bug_relation_not_self_e3ab3b8c', '"fromBugReportId" <> "toBugReportId"'),
          checkExpression(
            'bug_relation_type_check_f6e3255b',
            `"type" IN ('recurrence', 'duplicate')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'bug_release',
        columns: [
          col('approvalId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('bugReportId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('checkedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-date@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('environment', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('postReleaseCheckNotes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('postReleaseCheckPassed', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('releasedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('releasedById', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('version', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'bug_release_check_valid_23d52e8f',
            '("postReleaseCheckPassed" = false AND "checkedAt" IS NULL) OR ("postReleaseCheckPassed" = true AND "checkedAt" IS NOT NULL)',
          ),
          checkExpression(
            'bug_release_environment_check_d2a5394b',
            `"environment" IN ('production', 'staging', 'development', 'test', 'other')`,
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'bug_approval',
        constraint: 'bug_approval_bugReportId_fixAttemptId_key',
        columns: ['bugReportId', 'fixAttemptId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'bug_relation',
        constraint: 'bug_relation_fromBugReportId_toBugReportId_type_key',
        columns: ['fromBugReportId', 'toBugReportId', 'type'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'bug_release',
        constraint: 'bug_release_bugReportId_approvalId_key',
        columns: ['bugReportId', 'approvalId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_approval',
        index: 'bug_approval_bugReportId_idx_4618d902',
        columns: ['bugReportId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_approval',
        index: 'bug_approval_decidedById_decidedAt_idx_3d834c72',
        columns: ['decidedById', 'decidedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_approval',
        index: 'bug_approval_decidedById_idx_8194d55f',
        columns: ['decidedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_approval',
        index: 'bug_approval_fixAttemptId_idx_5b228f52',
        columns: ['fixAttemptId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_approval',
        index: 'bug_approval_status_submittedAt_idx_0938dd64',
        columns: ['status', 'submittedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_approval',
        index: 'bug_approval_submittedById_idx_89341c73',
        columns: ['submittedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_approval',
        index: 'bug_approval_submittedById_submittedAt_idx_b877594d',
        columns: ['submittedById', 'submittedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_evidence',
        index: 'bug_evidence_bugReportId_idx_4618d902',
        columns: ['bugReportId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_evidence',
        index: 'bug_evidence_bugReportId_kind_createdAt_idx_a038a98e',
        columns: ['bugReportId', 'kind', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_evidence',
        index: 'bug_evidence_fileAssetId_idx_84361fdc',
        columns: ['fileAssetId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_evidence',
        index: 'bug_evidence_fixAttemptId_idx_5b228f52',
        columns: ['fixAttemptId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_evidence',
        index: 'bug_evidence_fixAttemptId_kind_idx_33642ef0',
        columns: ['fixAttemptId', 'kind'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_evidence',
        index: 'bug_evidence_uploadedById_createdAt_idx_7e8cc7c7',
        columns: ['uploadedById', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_evidence',
        index: 'bug_evidence_uploadedById_idx_b92fad21',
        columns: ['uploadedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_fix_attempt',
        index: 'bug_fix_attempt_authorId_createdAt_idx_854b4c86',
        columns: ['authorId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_fix_attempt',
        index: 'bug_fix_attempt_authorId_idx_e47547ed',
        columns: ['authorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_fix_attempt',
        index: 'bug_fix_attempt_bugReportId_createdAt_idx_010ffdcd',
        columns: ['bugReportId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_fix_attempt',
        index: 'bug_fix_attempt_bugReportId_idx_4618d902',
        columns: ['bugReportId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_fix_attempt',
        index: 'bug_fix_attempt_verificationOutcome_verifiedAt_idx_92ddf49a',
        columns: ['verificationOutcome', 'verifiedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_fix_attempt',
        index: 'bug_fix_attempt_verifiedById_idx_dfd74b37',
        columns: ['verifiedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_relation',
        index: 'bug_relation_createdById_createdAt_idx_bbcfd794',
        columns: ['createdById', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_relation',
        index: 'bug_relation_createdById_idx_8bf640ed',
        columns: ['createdById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_relation',
        index: 'bug_relation_fromBugReportId_idx_8cf8c85f',
        columns: ['fromBugReportId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_relation',
        index: 'bug_relation_toBugReportId_idx_0886872a',
        columns: ['toBugReportId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_relation',
        index: 'bug_relation_toBugReportId_type_createdAt_idx_30839378',
        columns: ['toBugReportId', 'type', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_release',
        index: 'bug_release_approvalId_idx_23d09a03',
        columns: ['approvalId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_release',
        index: 'bug_release_bugReportId_idx_4618d902',
        columns: ['bugReportId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_release',
        index: 'bug_release_environment_releasedAt_idx_a0a953ca',
        columns: ['environment', 'releasedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_release',
        index: 'bug_release_releasedById_idx_f27c26c4',
        columns: ['releasedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_release',
        index: 'bug_release_releasedById_releasedAt_idx_6f231d18',
        columns: ['releasedById', 'releasedAt'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bug_approval',
        foreignKey: {
          name: 'bug_approval_bugReportId_fkey',
          columns: ['bugReportId'],
          references: { schema: 'public', table: 'bug_report', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bug_approval',
        foreignKey: {
          name: 'bug_approval_fixAttemptId_fkey',
          columns: ['fixAttemptId'],
          references: { schema: 'public', table: 'bug_fix_attempt', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bug_approval',
        foreignKey: {
          name: 'bug_approval_submittedById_fkey',
          columns: ['submittedById'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bug_approval',
        foreignKey: {
          name: 'bug_approval_decidedById_fkey',
          columns: ['decidedById'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bug_evidence',
        foreignKey: {
          name: 'bug_evidence_bugReportId_fkey',
          columns: ['bugReportId'],
          references: { schema: 'public', table: 'bug_report', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bug_evidence',
        foreignKey: {
          name: 'bug_evidence_fixAttemptId_fkey',
          columns: ['fixAttemptId'],
          references: { schema: 'public', table: 'bug_fix_attempt', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bug_evidence',
        foreignKey: {
          name: 'bug_evidence_fileAssetId_fkey',
          columns: ['fileAssetId'],
          references: { schema: 'public', table: 'file_asset', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bug_evidence',
        foreignKey: {
          name: 'bug_evidence_uploadedById_fkey',
          columns: ['uploadedById'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bug_fix_attempt',
        foreignKey: {
          name: 'bug_fix_attempt_bugReportId_fkey',
          columns: ['bugReportId'],
          references: { schema: 'public', table: 'bug_report', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bug_fix_attempt',
        foreignKey: {
          name: 'bug_fix_attempt_authorId_fkey',
          columns: ['authorId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bug_fix_attempt',
        foreignKey: {
          name: 'bug_fix_attempt_verifiedById_fkey',
          columns: ['verifiedById'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bug_relation',
        foreignKey: {
          name: 'bug_relation_fromBugReportId_fkey',
          columns: ['fromBugReportId'],
          references: { schema: 'public', table: 'bug_report', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bug_relation',
        foreignKey: {
          name: 'bug_relation_toBugReportId_fkey',
          columns: ['toBugReportId'],
          references: { schema: 'public', table: 'bug_report', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bug_relation',
        foreignKey: {
          name: 'bug_relation_createdById_fkey',
          columns: ['createdById'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bug_release',
        foreignKey: {
          name: 'bug_release_bugReportId_fkey',
          columns: ['bugReportId'],
          references: { schema: 'public', table: 'bug_report', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bug_release',
        foreignKey: {
          name: 'bug_release_approvalId_fkey',
          columns: ['approvalId'],
          references: { schema: 'public', table: 'bug_approval', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bug_release',
        foreignKey: {
          name: 'bug_release_releasedById_fkey',
          columns: ['releasedById'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
