#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/16a6a1b3b0c8b756c6b7f9eedae71077b9b7ffe4cc2956e85d0c5be805e4b496/contract';
import endContract from '../../snapshots/16a6a1b3b0c8b756c6b7f9eedae71077b9b7ffe4cc2956e85d0c5be805e4b496/contract.json' with { type: 'json' };
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
        table: 'webhook_delivery',
        columns: [
          col('attempts', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('deliveredAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-date@1' } }),
          col('endpointId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('eventId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('eventType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('lastError', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('payload', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('responseBody', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('responseCode', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('pending'),
            codecRef: { codecId: 'pg/text@1' },
          }),
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
        table: 'webhook_endpoint',
        columns: [
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
          col('events', 'text[]', {
            notNull: true,
            default: lit([]),
            codecRef: { codecId: 'pg/text@1', many: true },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('kind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('secretCiphertext', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('secretHint', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('url', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'webhook_endpoint_events_elem_not_null_3fea1ac8',
            'array_position("events", NULL) IS NULL',
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'webhook_delivery',
        constraint: 'webhook_delivery_endpointId_eventId_key',
        columns: ['endpointId', 'eventId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'webhook_delivery',
        index: 'webhook_delivery_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'webhook_delivery',
        index: 'webhook_delivery_endpointId_createdAt_idx_6af13a6b',
        columns: ['endpointId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'webhook_delivery',
        index: 'webhook_delivery_endpointId_idx_48273c15',
        columns: ['endpointId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'webhook_endpoint',
        index: 'webhook_endpoint_enabled_idx_7f014af8',
        columns: ['enabled'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'webhook_delivery',
        foreignKey: {
          name: 'webhook_delivery_endpointId_fkey',
          columns: ['endpointId'],
          references: { schema: 'public', table: 'webhook_endpoint', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
