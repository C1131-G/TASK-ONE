#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/31f39861cc2a39568d0c0eb68e9fa8f17355b1ad5331f47d57ae40048ce948b1/contract';
import startContract from '../../snapshots/31f39861cc2a39568d0c0eb68e9fa8f17355b1ad5331f47d57ae40048ce948b1/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/3e713382f93ef90aed7ac12d94e199668022017aae9b3e4f2bc1180c7a4fe6d6/contract';
import endContract from '../../snapshots/3e713382f93ef90aed7ac12d94e199668022017aae9b3e4f2bc1180c7a4fe6d6/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'calendar_feed_token',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('lastUsedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-date@1' } }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'calendar_feed_token',
        constraint: 'calendar_feed_token_userId_key',
        columns: ['userId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'calendar_feed_token',
        constraint: 'calendar_feed_token_tokenHash_key',
        columns: ['tokenHash'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'calendar_feed_token',
        foreignKey: {
          name: 'calendar_feed_token_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
