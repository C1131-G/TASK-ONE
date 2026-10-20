#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/15e177bc3628643bbddfcbefce631baf5a64f6750a45ca10c460ab21e7d92fdc/contract';
import startContract from '../../snapshots/15e177bc3628643bbddfcbefce631baf5a64f6750a45ca10c460ab21e7d92fdc/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/528b7cf51b0cd2ed9244a8c489cebe1c38cc3e470114a3762bee79d8f4eff192/contract';
import endContract from '../../snapshots/528b7cf51b0cd2ed9244a8c489cebe1c38cc3e470114a3762bee79d8f4eff192/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropIndex({
        schema: 'public',
        table: 'job',
        index: 'job_availableAt_leasedUntil_completedAt_deadAt_idx_69cc2ae0',
      }),
      this.createIndex({
        schema: 'public',
        table: 'job',
        index: 'job_claimable_30895498',
        columns: ['availableAt', 'leasedUntil'],
        extras: { where: '"completedAt" IS NULL AND "deadAt" IS NULL' },
      }),
      this.createIndex({
        schema: 'public',
        table: 'job',
        index: 'job_completed_b4a9c7bd',
        columns: ['completedAt'],
        extras: { where: '"completedAt" IS NOT NULL' },
      }),
      this.createIndex({
        schema: 'public',
        table: 'job',
        index: 'job_dead_a8ecce47',
        columns: ['deadAt'],
        extras: { where: '"deadAt" IS NOT NULL' },
      }),
      this.createIndex({
        schema: 'public',
        table: 'push_delivery',
        index: 'push_delivery_deliveredAt_idx_6b420379',
        columns: ['deliveredAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'session',
        index: 'session_expiresAt_idx_6b6b8c10',
        columns: ['expiresAt'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
