#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/180e8f1b951bd4584f86f671b3214067323faf1a52fa4c9bdae669d11aeba5ad/contract';
import endContract from '../../snapshots/180e8f1b951bd4584f86f671b3214067323faf1a52fa4c9bdae669d11aeba5ad/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/8e74fac8e22b16ea02fecd15347e3c2687d5167d67bf6724fd5c980568b21bce/contract';
import startContract from '../../snapshots/8e74fac8e22b16ea02fecd15347e3c2687d5167d67bf6724fd5c980568b21bce/contract.json' with { type: 'json' };
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
        table: 'github_connection',
        columns: [
          col('autoCompleteOnMerge', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('createdById', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('enabled', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('projectId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('repoFullName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('secretCiphertext', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('secretHint', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'github_delivery',
        columns: [
          col('connectionId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('deliveryId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('event', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'github_pull_link',
        columns: [
          col('authorLogin', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('connectionId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('mergedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-date@1' } }),
          col('prNumber', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('state', 'text', {
            notNull: true,
            default: lit('open'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('taskId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('url', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('github_pull_link_number_positive_d72b835d', '"prNumber" > 0'),
          checkExpression(
            'github_pull_link_state_valid_57fa9413',
            `"state" IN ('open', 'closed', 'merged')`,
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'github_connection',
        constraint: 'github_connection_repoFullName_key',
        columns: ['repoFullName'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'github_delivery',
        constraint: 'github_delivery_connectionId_deliveryId_key',
        columns: ['connectionId', 'deliveryId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'github_pull_link',
        constraint: 'github_pull_link_connectionId_taskId_prNumber_key',
        columns: ['connectionId', 'taskId', 'prNumber'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'github_connection',
        index: 'github_connection_createdById_idx_8bf640ed',
        columns: ['createdById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'github_connection',
        index: 'github_connection_projectId_idx_a96e4d92',
        columns: ['projectId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'github_delivery',
        index: 'github_delivery_connectionId_idx_b3eeb6ac',
        columns: ['connectionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'github_delivery',
        index: 'github_delivery_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'github_pull_link',
        index: 'github_pull_link_connectionId_idx_b3eeb6ac',
        columns: ['connectionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'github_pull_link',
        index: 'github_pull_link_taskId_idx_4965c936',
        columns: ['taskId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'github_connection',
        foreignKey: {
          name: 'github_connection_projectId_fkey',
          columns: ['projectId'],
          references: { schema: 'public', table: 'project', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'github_connection',
        foreignKey: {
          name: 'github_connection_createdById_fkey',
          columns: ['createdById'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'github_delivery',
        foreignKey: {
          name: 'github_delivery_connectionId_fkey',
          columns: ['connectionId'],
          references: { schema: 'public', table: 'github_connection', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'github_pull_link',
        foreignKey: {
          name: 'github_pull_link_connectionId_fkey',
          columns: ['connectionId'],
          references: { schema: 'public', table: 'github_connection', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'github_pull_link',
        foreignKey: {
          name: 'github_pull_link_taskId_fkey',
          columns: ['taskId'],
          references: { schema: 'public', table: 'task', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
