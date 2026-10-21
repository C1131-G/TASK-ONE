#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/575820c8a625da507802a6a5ae4b54ee970f8c146bd57d825f38c527cac3678f/contract';
import endContract from '../../snapshots/575820c8a625da507802a6a5ae4b54ee970f8c146bd57d825f38c527cac3678f/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/ac95d16f166f37e55580dbec1c832a96fbf96f663e6bc8f9c1a161969ef63588/contract';
import startContract from '../../snapshots/ac95d16f166f37e55580dbec1c832a96fbf96f663e6bc8f9c1a161969ef63588/contract.json' with { type: 'json' };
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
        table: 'project_budget',
        columns: [
          col('billableOnly', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('budgetMinutes', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('currency', 'text', {
            notNull: true,
            default: lit('USD'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('hourlyRateCents', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('kind', 'text', {
            notNull: true,
            default: lit('one_off'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('projectId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('warningPercent', 'int4', {
            notNull: true,
            default: lit(80),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [
          primaryKey(['projectId']),
          checkExpression(
            'project_budget_kind_check_de785e65',
            `"kind" IN ('one_off', 'retainer')`,
          ),
          checkExpression('project_budget_minutes_positive_81247551', '"budgetMinutes" > 0'),
          checkExpression(
            'project_budget_rate_non_negative_b6a6c68b',
            '"hourlyRateCents" IS NULL OR "hourlyRateCents" >= 0',
          ),
          checkExpression(
            'project_budget_warning_percent_087517d6',
            '"warningPercent" BETWEEN 1 AND 100',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'project_budget_alert',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('level', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('periodKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('projectId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['projectId', 'periodKey', 'level']),
          checkExpression(
            'project_budget_alert_level_check_57e39686',
            `"level" IN ('warning', 'overrun')`,
          ),
        ],
      }),
      this.createIndex({
        schema: 'public',
        table: 'project_budget_alert',
        index: 'project_budget_alert_projectId_idx_a96e4d92',
        columns: ['projectId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'project_budget',
        foreignKey: {
          name: 'project_budget_projectId_fkey',
          columns: ['projectId'],
          references: { schema: 'public', table: 'project', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'project_budget_alert',
        foreignKey: {
          name: 'project_budget_alert_projectId_fkey',
          columns: ['projectId'],
          references: { schema: 'public', table: 'project_budget', columns: ['projectId'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
