#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/15e177bc3628643bbddfcbefce631baf5a64f6750a45ca10c460ab21e7d92fdc/contract';
import endContract from '../../snapshots/15e177bc3628643bbddfcbefce631baf5a64f6750a45ca10c460ab21e7d92fdc/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/8314e79f5bf578c3f197f6956169c1816915afffd19b0d8c13ccdb6effb49296/contract';
import startContract from '../../snapshots/8314e79f5bf578c3f197f6956169c1816915afffd19b0d8c13ccdb6effb49296/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'bug_sla',
        column: col('resolutionStartedAt', 'timestamptz', {
          notNull: true,
          default: fn('now()'),
          codecRef: { codecId: 'pg/timestamptz-date@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
