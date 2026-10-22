#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/379bafff1fbd2cb8ae91b695683f1af541013e9345916fa951085c414cf213af/contract';
import endContract from '../../snapshots/379bafff1fbd2cb8ae91b695683f1af541013e9345916fa951085c414cf213af/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/64b02b38ba996661463c3bbce835c0c6c3633125b371ec0b8cf47c1623eb4a3c/contract';
import startContract from '../../snapshots/64b02b38ba996661463c3bbce835c0c6c3633125b371ec0b8cf47c1623eb4a3c/contract.json' with { type: 'json' };
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
        table: 'intake_form',
        columns: [
          col('clientCompanyId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
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
          col('slug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
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
        table: 'intake_submission',
        columns: [
          col('bugReportId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('formId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('messageId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('referenceId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reporterEmail', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('senderHash', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('source', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'intake_submission_source_valid_8448c890',
            `"source" IN ('web', 'email')`,
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'intake_form',
        constraint: 'intake_form_slug_key',
        columns: ['slug'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'intake_submission',
        constraint: 'intake_submission_referenceId_key',
        columns: ['referenceId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'intake_submission',
        constraint: 'intake_submission_bugReportId_key',
        columns: ['bugReportId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'intake_submission',
        constraint: 'intake_submission_formId_messageId_key',
        columns: ['formId', 'messageId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'intake_form',
        index: 'intake_form_clientCompanyId_idx_157c8ca5',
        columns: ['clientCompanyId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'intake_form',
        index: 'intake_form_createdById_idx_8bf640ed',
        columns: ['createdById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'intake_form',
        index: 'intake_form_projectId_idx_a96e4d92',
        columns: ['projectId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'intake_submission',
        index: 'intake_submission_formId_createdAt_idx_70828f6f',
        columns: ['formId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'intake_submission',
        index: 'intake_submission_formId_idx_3c13a9fa',
        columns: ['formId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'intake_submission',
        index: 'intake_submission_senderHash_createdAt_idx_3726379b',
        columns: ['senderHash', 'createdAt'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'intake_form',
        foreignKey: {
          name: 'intake_form_clientCompanyId_fkey',
          columns: ['clientCompanyId'],
          references: { schema: 'public', table: 'client_company', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'intake_form',
        foreignKey: {
          name: 'intake_form_projectId_fkey',
          columns: ['projectId'],
          references: { schema: 'public', table: 'project', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'intake_form',
        foreignKey: {
          name: 'intake_form_createdById_fkey',
          columns: ['createdById'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'intake_submission',
        foreignKey: {
          name: 'intake_submission_formId_fkey',
          columns: ['formId'],
          references: { schema: 'public', table: 'intake_form', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'intake_submission',
        foreignKey: {
          name: 'intake_submission_bugReportId_fkey',
          columns: ['bugReportId'],
          references: { schema: 'public', table: 'bug_report', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
