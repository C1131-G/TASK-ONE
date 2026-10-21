#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/31f39861cc2a39568d0c0eb68e9fa8f17355b1ad5331f47d57ae40048ce948b1/contract';
import endContract from '../../snapshots/31f39861cc2a39568d0c0eb68e9fa8f17355b1ad5331f47d57ae40048ce948b1/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/528b7cf51b0cd2ed9244a8c489cebe1c38cc3e470114a3762bee79d8f4eff192/contract';
import startContract from '../../snapshots/528b7cf51b0cd2ed9244a8c489cebe1c38cc3e470114a3762bee79d8f4eff192/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'email_delivery',
        columns: [
          col('dedupeKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('sentAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'email_setting',
        columns: [
          col('digest', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('lastDigestAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-date@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['userId'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'email_delivery',
        constraint: 'email_delivery_dedupeKey_key',
        columns: ['dedupeKey'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'email_delivery',
        index: 'email_delivery_sentAt_idx_143b1b4c',
        columns: ['sentAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'email_delivery',
        index: 'email_delivery_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'email_delivery',
        index: 'email_delivery_userId_sentAt_idx_3005d120',
        columns: ['userId', 'sentAt'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'email_delivery',
        foreignKey: {
          name: 'email_delivery_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'email_setting',
        foreignKey: {
          name: 'email_setting_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
