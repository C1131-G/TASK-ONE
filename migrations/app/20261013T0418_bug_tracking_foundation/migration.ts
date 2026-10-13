#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/6bab5524fa68e874d5dc8f096ee95993ad65cd59501e79b4f3fb07b94eb6d6e0/contract';
import endContract from '../../snapshots/6bab5524fa68e874d5dc8f096ee95993ad65cd59501e79b4f3fb07b94eb6d6e0/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/7e3ecb92acdb436c18b9f4a11e952c59156c5c16fa8f6dba04cab511c5ffc61a/contract';
import startContract from '../../snapshots/7e3ecb92acdb436c18b9f4a11e952c59156c5c16fa8f6dba04cab511c5ffc61a/contract.json' with { type: 'json' };
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
        table: 'bug_report',
        columns: [
          col('actualBehavior', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('appVersion', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('browser', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('component', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('device', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('discoveredAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('discoverySource', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('environment', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('expectedBehavior', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('os', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('projectId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('reporterId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reproductionSteps', 'text[]', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1', many: true },
          }),
          col('route', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('severity', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('reported'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('taskId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
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
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'bug_report_discoverySource_check_3697728e',
            `"discoverySource" IN ('internal_qa', 'customer_report', 'support', 'automated_test', 'monitoring', 'employee_report')`,
          ),
          checkExpression(
            'bug_report_environment_check_d2a5394b',
            `"environment" IN ('production', 'staging', 'development', 'test', 'other')`,
          ),
          checkExpression(
            'bug_report_reproductionSteps_elem_not_null_5718606e',
            'array_position("reproductionSteps", NULL) IS NULL',
          ),
          checkExpression(
            'bug_report_severity_check_be538c8d',
            `"severity" IN ('blocker', 'critical', 'major', 'minor', 'trivial')`,
          ),
          checkExpression(
            'bug_report_status_check_c394d412',
            `"status" IN ('reported', 'triaged', 'in_progress', 'in_verification', 'awaiting_admin_approval', 'approved_for_release', 'released', 'closed', 'duplicate', 'rejected')`,
          ),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'task',
        column: col('type', 'text', {
          notNull: true,
          default: lit('task'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'bug_report',
        constraint: 'bug_report_taskId_key',
        columns: ['taskId'],
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'task',
        constraint: 'task_type_check_8ce82576',
        expression: `"type" IN ('task', 'bug')`,
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_report',
        index: 'bug_report_projectId_idx_a96e4d92',
        columns: ['projectId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_report',
        index: 'bug_report_projectId_status_severity_discoveredAt_idx_97501c36',
        columns: ['projectId', 'status', 'severity', 'discoveredAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_report',
        index: 'bug_report_reporterId_discoveredAt_idx_f784a7c3',
        columns: ['reporterId', 'discoveredAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_report',
        index: 'bug_report_reporterId_idx_aa245831',
        columns: ['reporterId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_report',
        index: 'bug_report_status_discoveredAt_idx_e380dead',
        columns: ['status', 'discoveredAt'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bug_report',
        foreignKey: {
          name: 'bug_report_taskId_fkey',
          columns: ['taskId'],
          references: { schema: 'public', table: 'task', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bug_report',
        foreignKey: {
          name: 'bug_report_projectId_fkey',
          columns: ['projectId'],
          references: { schema: 'public', table: 'project', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bug_report',
        foreignKey: {
          name: 'bug_report_reporterId_fkey',
          columns: ['reporterId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
