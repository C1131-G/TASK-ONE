#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/180e8f1b951bd4584f86f671b3214067323faf1a52fa4c9bdae669d11aeba5ad/contract';
import startContract from '../../snapshots/180e8f1b951bd4584f86f671b3214067323faf1a52fa4c9bdae669d11aeba5ad/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/608dc31d67ecd9a0c2618becee5d1de50b2ad1f2ff1ce785b9611f852cfc83b5/contract';
import endContract from '../../snapshots/608dc31d67ecd9a0c2618becee5d1de50b2ad1f2ff1ce785b9611f852cfc83b5/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'automation_rule',
        columns: [
          col('actions', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('conditions', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
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
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('projectId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('trigger', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('version', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'automation_run',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('depth', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('eventId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('outcome', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('projectId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('reason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('ruleId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('taskId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('trigger', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'automation_run',
        constraint: 'automation_run_ruleId_eventId_key',
        columns: ['ruleId', 'eventId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'automation_rule',
        index: 'automation_rule_createdById_idx_8bf640ed',
        columns: ['createdById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'automation_rule',
        index: 'automation_rule_projectId_enabled_trigger_idx_04904db6',
        columns: ['projectId', 'enabled', 'trigger'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'automation_rule',
        index: 'automation_rule_projectId_idx_a96e4d92',
        columns: ['projectId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'automation_run',
        index: 'automation_run_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'automation_run',
        index: 'automation_run_projectId_createdAt_idx_d2d6484f',
        columns: ['projectId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'automation_run',
        index: 'automation_run_projectId_idx_a96e4d92',
        columns: ['projectId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'automation_run',
        index: 'automation_run_ruleId_idx_05e770f7',
        columns: ['ruleId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'automation_run',
        index: 'automation_run_ruleId_taskId_createdAt_idx_5c233d78',
        columns: ['ruleId', 'taskId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'automation_run',
        index: 'automation_run_taskId_idx_4965c936',
        columns: ['taskId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'automation_rule',
        foreignKey: {
          name: 'automation_rule_projectId_fkey',
          columns: ['projectId'],
          references: { schema: 'public', table: 'project', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'automation_rule',
        foreignKey: {
          name: 'automation_rule_createdById_fkey',
          columns: ['createdById'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'automation_run',
        foreignKey: {
          name: 'automation_run_ruleId_fkey',
          columns: ['ruleId'],
          references: { schema: 'public', table: 'automation_rule', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'automation_run',
        foreignKey: {
          name: 'automation_run_projectId_fkey',
          columns: ['projectId'],
          references: { schema: 'public', table: 'project', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'automation_run',
        foreignKey: {
          name: 'automation_run_taskId_fkey',
          columns: ['taskId'],
          references: { schema: 'public', table: 'task', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
