#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/0c39b3902c34577dc80fcc37e1cc1cf47742d70cedc76387007bac30753895f2/contract';
import startContract from '../../snapshots/0c39b3902c34577dc80fcc37e1cc1cf47742d70cedc76387007bac30753895f2/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/25ecf1b0c580b4b20b04b7c75a1bdad389a9c26ac3caa5c659e76e4179f9692f/contract';
import endContract from '../../snapshots/25ecf1b0c580b4b20b04b7c75a1bdad389a9c26ac3caa5c659e76e4179f9692f/contract.json' with { type: 'json' };
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
        table: 'custom_field',
        columns: [
          col('archivedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-date@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('options', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
          col('position', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('projectId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('required', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'custom_field_options_for_select_b93ed7ff',
            `("type" = 'select') = ("options" IS NOT NULL)`,
          ),
          checkExpression('custom_field_position_valid_f43e8efc', '"position" >= 0'),
          checkExpression(
            'custom_field_type_valid_ab46f3fe',
            `"type" IN ('text', 'number', 'select', 'date', 'checkbox')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'custom_field_value',
        columns: [
          col('boolValue', 'bool', { codecRef: { codecId: 'pg/bool@1' } }),
          col('dateValue', 'date', { codecRef: { codecId: 'pg/date-string@1' } }),
          col('fieldId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('numberValue', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
          col('taskId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('textValue', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'custom_field_value_one_column_395b7d69',
            'num_nonnulls("textValue", "numberValue", "dateValue", "boolValue") = 1',
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'custom_field_value',
        constraint: 'custom_field_value_taskId_fieldId_key',
        columns: ['taskId', 'fieldId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'custom_field',
        index: 'custom_field_projectId_idx_a96e4d92',
        columns: ['projectId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'custom_field',
        index: 'custom_field_projectId_position_idx_8e0c4225',
        columns: ['projectId', 'position'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'custom_field_value',
        index: 'custom_field_value_fieldId_idx_44d815d7',
        columns: ['fieldId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'custom_field_value',
        index: 'custom_field_value_taskId_idx_4965c936',
        columns: ['taskId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'custom_field',
        foreignKey: {
          name: 'custom_field_projectId_fkey',
          columns: ['projectId'],
          references: { schema: 'public', table: 'project', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'custom_field_value',
        foreignKey: {
          name: 'custom_field_value_taskId_fkey',
          columns: ['taskId'],
          references: { schema: 'public', table: 'task', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'custom_field_value',
        foreignKey: {
          name: 'custom_field_value_fieldId_fkey',
          columns: ['fieldId'],
          references: { schema: 'public', table: 'custom_field', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
