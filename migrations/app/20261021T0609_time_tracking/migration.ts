#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/3e713382f93ef90aed7ac12d94e199668022017aae9b3e4f2bc1180c7a4fe6d6/contract';
import startContract from '../../snapshots/3e713382f93ef90aed7ac12d94e199668022017aae9b3e4f2bc1180c7a4fe6d6/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/ac95d16f166f37e55580dbec1c832a96fbf96f663e6bc8f9c1a161969ef63588/contract';
import endContract from '../../snapshots/ac95d16f166f37e55580dbec1c832a96fbf96f663e6bc8f9c1a161969ef63588/contract.json' with { type: 'json' };
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
        table: 'time_entry',
        columns: [
          col('billable', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('minutes', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('note', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('taskId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('workDate', 'date', { notNull: true, codecRef: { codecId: 'pg/date-string@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'time_entry_minutes_in_day_00206769',
            '"minutes" > 0 AND "minutes" <= 1440',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'time_timer',
        columns: [
          col('billable', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('note', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('startedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('taskId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['userId'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'time_entry',
        index: 'time_entry_taskId_idx_4965c936',
        columns: ['taskId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'time_entry',
        index: 'time_entry_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'time_entry',
        index: 'time_entry_userId_workDate_idx_3e48748b',
        columns: ['userId', 'workDate'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'time_timer',
        index: 'time_timer_taskId_idx_4965c936',
        columns: ['taskId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'time_entry',
        foreignKey: {
          name: 'time_entry_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'time_entry',
        foreignKey: {
          name: 'time_entry_taskId_fkey',
          columns: ['taskId'],
          references: { schema: 'public', table: 'task', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'time_timer',
        foreignKey: {
          name: 'time_timer_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'time_timer',
        foreignKey: {
          name: 'time_timer_taskId_fkey',
          columns: ['taskId'],
          references: { schema: 'public', table: 'task', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
