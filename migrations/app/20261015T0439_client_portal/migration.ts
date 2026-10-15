#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/355cc70312fab7ba7944feadfb00a98a58e6f0fce3cc7aeb0bbd4910b49f0058/contract';
import startContract from '../../snapshots/355cc70312fab7ba7944feadfb00a98a58e6f0fce3cc7aeb0bbd4910b49f0058/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/8f40d527d8de3612647281d0ab83da9e2e4f4f1b0ec566a04c54fe753856ad66/contract';
import endContract from '../../snapshots/8f40d527d8de3612647281d0ab83da9e2e4f4f1b0ec566a04c54fe753856ad66/contract.json' with { type: 'json' };
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
      this.dropCheckConstraint({
        schema: 'public',
        table: 'bug_report',
        constraint: 'bug_report_status_check_c394d412',
      }),
      this.dropCheckConstraint({
        schema: 'public',
        table: 'notification',
        constraint: 'notification_type_check_cac43c93',
      }),
      this.dropCheckConstraint({
        schema: 'public',
        table: 'user',
        constraint: 'user_role_valid_2461e6a1',
      }),
      this.createTable({
        schema: 'public',
        table: 'audit_event',
        columns: [
          col('actorId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('details', 'jsonb', {
            notNull: true,
            default: lit({}),
            codecRef: { codecId: 'pg/jsonb@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('ip', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('subjectUserId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userAgent', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'bug_sla',
        columns: [
          col('breachedResolution', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('breachedResponse', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('bugId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('firstRespondedAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('firstResponseDueAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('pausedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-date@1' } }),
          col('pausedBusinessMs', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('resolutionDueAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('resolvedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-date@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('warnedResolution', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('warnedResponse', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
        ],
        constraints: [
          primaryKey(['bugId']),
          checkExpression('bug_sla_paused_nonnegative_50d1a49c', '"pausedBusinessMs" >= 0'),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'client_company',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('createdById', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('deactivatedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-date@1' } }),
          col('deactivatedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('logoAssetId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
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
            'client_company_deactivation_fields_paired_68ebd7ec',
            '("deactivatedAt" IS NULL AND "deactivatedById" IS NULL) OR ("deactivatedAt" IS NOT NULL AND "deactivatedById" IS NOT NULL)',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'client_company_handler',
        columns: [
          col('assignedById', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('companyId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('employeeId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'client_company_project',
        columns: [
          col('addedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('companyId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('projectId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('removedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-date@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'bug_report',
        column: col('awaitingClientSince', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-date@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'bug_report',
        column: col('clientCompanyId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'bug_report',
        column: col('clientImpact', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'bug_report',
        column: col('clientReopenCount', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'bug_report',
        column: col('needsInfoSince', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-date@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'bug_report',
        column: col('needsReassignment', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'bug_report',
        column: col('pickedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-date@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'bug_report',
        column: col('pickedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'bug_report',
        column: col('satisfaction', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'bug_report',
        column: col('satisfactionComment', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'bug_report',
        column: col('statusBeforeNeedsInfo', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'comment',
        column: col('visibility', 'text', {
          notNull: true,
          default: lit('internal'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'company_settings',
        column: col('businessDays', 'int4[]', {
          notNull: true,
          default: lit([1, 2, 3, 4, 5]),
          codecRef: { codecId: 'pg/int4@1', many: true },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'company_settings',
        column: col('businessEndMinute', 'int4', {
          notNull: true,
          default: lit(1080),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'company_settings',
        column: col('businessStartMinute', 'int4', {
          notNull: true,
          default: lit(540),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'company_settings',
        column: col('businessTimeZone', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'company_settings',
        column: col('slaTargets', 'jsonb', {
          notNull: true,
          default: lit({
            high: { firstResponseMinutes: 240, resolutionMinutes: 1440 },
            low: { firstResponseMinutes: 1440, resolutionMinutes: 14400 },
            medium: { firstResponseMinutes: 480, resolutionMinutes: 4800 },
            urgent: { firstResponseMinutes: 60, resolutionMinutes: 480 },
          }),
          codecRef: { codecId: 'pg/jsonb@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('clientCompanyId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('failedLoginCount', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('lastActiveAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-date@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('lockedUntil', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-date@1' },
        }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'bug_report',
        constraint: 'bug_report_clientImpact_check_b835bb9b',
        expression: `"clientImpact" IN ('low', 'medium', 'high', 'urgent')`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'bug_report',
        constraint: 'bug_report_client_reopen_count_nonnegative_dc549469',
        expression: '"clientReopenCount" >= 0',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'bug_report',
        constraint: 'bug_report_pick_fields_paired_2ed2462b',
        expression:
          '("pickedById" IS NULL AND "pickedAt" IS NULL) OR ("pickedById" IS NOT NULL AND "pickedAt" IS NOT NULL)',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'bug_report',
        constraint: 'bug_report_satisfaction_check_d407e712',
        expression: `"satisfaction" IN ('up', 'down')`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'bug_report',
        constraint: 'bug_report_statusBeforeNeedsInfo_check_39cbe58a',
        expression: `"statusBeforeNeedsInfo" IN ('reported', 'triaged', 'in_progress', 'in_verification', 'awaiting_admin_approval', 'approved_for_release', 'released', 'closed', 'duplicate', 'rejected', 'needs_info', 'awaiting_client', 'withdrawn')`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'bug_report',
        constraint: 'bug_report_status_check_57f24d78',
        expression: `"status" IN ('reported', 'triaged', 'in_progress', 'in_verification', 'awaiting_admin_approval', 'approved_for_release', 'released', 'closed', 'duplicate', 'rejected', 'needs_info', 'awaiting_client', 'withdrawn')`,
      }),
      this.addUnique({
        schema: 'public',
        table: 'client_company',
        constraint: 'client_company_name_key',
        columns: ['name'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'client_company_handler',
        constraint: 'client_company_handler_companyId_employeeId_key',
        columns: ['companyId', 'employeeId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'client_company_project',
        constraint: 'client_company_project_companyId_projectId_key',
        columns: ['companyId', 'projectId'],
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'comment',
        constraint: 'comment_visibility_check_4dc990d4',
        expression: `"visibility" IN ('public', 'internal')`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'company_settings',
        constraint: 'company_settings_businessDays_elem_not_null_12212d77',
        expression: 'array_position("businessDays", NULL) IS NULL',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'company_settings',
        constraint: 'company_settings_business_hours_valid_c2cea7ba',
        expression:
          '"businessStartMinute" >= 0 AND "businessEndMinute" <= 1440 AND "businessStartMinute" < "businessEndMinute"',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'notification',
        constraint: 'notification_type_check_5a30586b',
        expression: `"type" IN ('mention', 'assignment', 'comment', 'update', 'due', 'client_bug', 'status', 'sla')`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'user',
        constraint: 'user_client_company_matches_role_b6027f33',
        expression: `(role = 'client') = ("clientCompanyId" IS NOT NULL)`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'user',
        constraint: 'user_failed_login_count_nonnegative_d4c930d0',
        expression: '"failedLoginCount" >= 0',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'user',
        constraint: 'user_role_valid_28c73bc5',
        expression: "role IN ('admin', 'employee', 'client')",
      }),
      this.createIndex({
        schema: 'public',
        table: 'audit_event',
        index: 'audit_event_actorId_createdAt_idx_0e9f1adf',
        columns: ['actorId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'audit_event',
        index: 'audit_event_actorId_idx_a58f6b4b',
        columns: ['actorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'audit_event',
        index: 'audit_event_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'audit_event',
        index: 'audit_event_subjectUserId_createdAt_idx_c8b7019e',
        columns: ['subjectUserId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'audit_event',
        index: 'audit_event_subjectUserId_idx_60714ffd',
        columns: ['subjectUserId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'audit_event',
        index: 'audit_event_type_createdAt_idx_00d94001',
        columns: ['type', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_report',
        index: 'bug_report_clientCompanyId_idx_157c8ca5',
        columns: ['clientCompanyId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_report',
        index: 'bug_report_clientCompanyId_status_discoveredAt_idx_4230304e',
        columns: ['clientCompanyId', 'status', 'discoveredAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_report',
        index: 'bug_report_pickedById_idx_1578802c',
        columns: ['pickedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_sla',
        index: 'bug_sla_firstRespondedAt_firstResponseDueAt_idx_47055610',
        columns: ['firstRespondedAt', 'firstResponseDueAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bug_sla',
        index: 'bug_sla_resolvedAt_resolutionDueAt_idx_f6514db1',
        columns: ['resolvedAt', 'resolutionDueAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'client_company',
        index: 'client_company_createdById_idx_8bf640ed',
        columns: ['createdById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'client_company',
        index: 'client_company_deactivatedAt_idx_61cfa815',
        columns: ['deactivatedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'client_company',
        index: 'client_company_deactivatedById_idx_12fe95fd',
        columns: ['deactivatedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'client_company_handler',
        index: 'client_company_handler_assignedById_idx_f5db02c3',
        columns: ['assignedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'client_company_handler',
        index: 'client_company_handler_companyId_idx_33acc5ed',
        columns: ['companyId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'client_company_handler',
        index: 'client_company_handler_employeeId_idx_087dd4a6',
        columns: ['employeeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'client_company_project',
        index: 'client_company_project_companyId_idx_33acc5ed',
        columns: ['companyId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'client_company_project',
        index: 'client_company_project_projectId_idx_a96e4d92',
        columns: ['projectId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'user',
        index: 'user_clientCompanyId_idx_157c8ca5',
        columns: ['clientCompanyId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'audit_event',
        foreignKey: {
          name: 'audit_event_actorId_fkey',
          columns: ['actorId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'audit_event',
        foreignKey: {
          name: 'audit_event_subjectUserId_fkey',
          columns: ['subjectUserId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bug_report',
        foreignKey: {
          name: 'bug_report_pickedById_fkey',
          columns: ['pickedById'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bug_sla',
        foreignKey: {
          name: 'bug_sla_bugId_fkey',
          columns: ['bugId'],
          references: { schema: 'public', table: 'bug_report', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'client_company',
        foreignKey: {
          name: 'client_company_createdById_fkey',
          columns: ['createdById'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'client_company',
        foreignKey: {
          name: 'client_company_deactivatedById_fkey',
          columns: ['deactivatedById'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bug_report',
        foreignKey: {
          name: 'bug_report_clientCompanyId_fkey',
          columns: ['clientCompanyId'],
          references: { schema: 'public', table: 'client_company', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'client_company_handler',
        foreignKey: {
          name: 'client_company_handler_companyId_fkey',
          columns: ['companyId'],
          references: { schema: 'public', table: 'client_company', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'client_company_handler',
        foreignKey: {
          name: 'client_company_handler_employeeId_fkey',
          columns: ['employeeId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'client_company_handler',
        foreignKey: {
          name: 'client_company_handler_assignedById_fkey',
          columns: ['assignedById'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'client_company_project',
        foreignKey: {
          name: 'client_company_project_companyId_fkey',
          columns: ['companyId'],
          references: { schema: 'public', table: 'client_company', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'client_company_project',
        foreignKey: {
          name: 'client_company_project_projectId_fkey',
          columns: ['projectId'],
          references: { schema: 'public', table: 'project', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'user',
        foreignKey: {
          name: 'user_clientCompanyId_fkey',
          columns: ['clientCompanyId'],
          references: { schema: 'public', table: 'client_company', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
