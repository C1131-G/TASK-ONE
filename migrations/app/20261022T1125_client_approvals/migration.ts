#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/180e8f1b951bd4584f86f671b3214067323faf1a52fa4c9bdae669d11aeba5ad/contract';
import startContract from '../../snapshots/180e8f1b951bd4584f86f671b3214067323faf1a52fa4c9bdae669d11aeba5ad/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/261031b9074f70042580593b45ae00216718af3997a2e5d573fef4f2ddbe4d93/contract';
import endContract from '../../snapshots/261031b9074f70042580593b45ae00216718af3997a2e5d573fef4f2ddbe4d93/contract.json' with { type: 'json' };
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
        table: 'approval_request',
        columns: [
          col('cancelledAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-date@1' } }),
          col('cancelledById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('companyId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('decidedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-date@1' } }),
          col('decidedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('decisionComment', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('message', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('milestoneId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('projectId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('requestedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('requestedById', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('pending'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('subjectKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('subjectTitle', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('taskId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('version', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'approval_request_one_subject_75cd91e2',
            '("taskId" IS NOT NULL) <> ("milestoneId" IS NOT NULL)',
          ),
          checkExpression(
            'approval_request_status_valid_a989b6ba',
            `("status" = 'pending' AND "decidedById" IS NULL AND "decidedAt" IS NULL AND "decisionComment" IS NULL AND "cancelledAt" IS NULL) OR ("status" = 'approved' AND "decidedById" IS NOT NULL AND "decidedAt" IS NOT NULL AND "cancelledAt" IS NULL) OR ("status" = 'changes_requested' AND "decidedById" IS NOT NULL AND "decidedAt" IS NOT NULL AND length(trim("decisionComment")) > 0 AND "cancelledAt" IS NULL) OR ("status" = 'cancelled' AND "decidedById" IS NULL AND "decidedAt" IS NULL AND "cancelledById" IS NOT NULL AND "cancelledAt" IS NOT NULL)`,
          ),
          checkExpression('approval_request_version_positive_efca705d', '"version" > 0'),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'approval_request_file',
        columns: [
          col('fileId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('requestId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'approval_request',
        constraint: 'approval_request_subjectKey_companyId_version_key',
        columns: ['subjectKey', 'companyId', 'version'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'approval_request_file',
        constraint: 'approval_request_file_requestId_fileId_key',
        columns: ['requestId', 'fileId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'approval_request',
        index: 'approval_request_cancelledById_idx_03ce7bea',
        columns: ['cancelledById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'approval_request',
        index: 'approval_request_companyId_idx_33acc5ed',
        columns: ['companyId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'approval_request',
        index: 'approval_request_companyId_status_requestedAt_idx_ce646468',
        columns: ['companyId', 'status', 'requestedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'approval_request',
        index: 'approval_request_decidedById_idx_8194d55f',
        columns: ['decidedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'approval_request',
        index: 'approval_request_projectId_idx_a96e4d92',
        columns: ['projectId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'approval_request',
        index: 'approval_request_requestedById_idx_f9a56c66',
        columns: ['requestedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'approval_request',
        index: 'approval_request_taskId_idx_4965c936',
        columns: ['taskId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'approval_request_file',
        index: 'approval_request_file_fileId_idx_9a9e456b',
        columns: ['fileId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'approval_request_file',
        index: 'approval_request_file_requestId_idx_fd667f92',
        columns: ['requestId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'approval_request',
        foreignKey: {
          name: 'approval_request_projectId_fkey',
          columns: ['projectId'],
          references: { schema: 'public', table: 'project', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'approval_request',
        foreignKey: {
          name: 'approval_request_companyId_fkey',
          columns: ['companyId'],
          references: { schema: 'public', table: 'client_company', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'approval_request',
        foreignKey: {
          name: 'approval_request_taskId_fkey',
          columns: ['taskId'],
          references: { schema: 'public', table: 'task', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'approval_request',
        foreignKey: {
          name: 'approval_request_requestedById_fkey',
          columns: ['requestedById'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'approval_request',
        foreignKey: {
          name: 'approval_request_decidedById_fkey',
          columns: ['decidedById'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'approval_request',
        foreignKey: {
          name: 'approval_request_cancelledById_fkey',
          columns: ['cancelledById'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'approval_request_file',
        foreignKey: {
          name: 'approval_request_file_requestId_fkey',
          columns: ['requestId'],
          references: { schema: 'public', table: 'approval_request', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'approval_request_file',
        foreignKey: {
          name: 'approval_request_file_fileId_fkey',
          columns: ['fileId'],
          references: { schema: 'public', table: 'file_asset', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
