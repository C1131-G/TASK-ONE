#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/528b7cf51b0cd2ed9244a8c489cebe1c38cc3e470114a3762bee79d8f4eff192/contract';
import startContract from '../../snapshots/528b7cf51b0cd2ed9244a8c489cebe1c38cc3e470114a3762bee79d8f4eff192/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/c975f8e5e1b1bf358a69ade14324983fb685a95315b23370c96ff4a4c9899b0a/contract';
import endContract from '../../snapshots/c975f8e5e1b1bf358a69ade14324983fb685a95315b23370c96ff4a4c9899b0a/contract.json' with { type: 'json' };
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
