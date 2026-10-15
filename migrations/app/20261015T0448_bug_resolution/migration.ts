#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/8314e79f5bf578c3f197f6956169c1816915afffd19b0d8c13ccdb6effb49296/contract';
import endContract from '../../snapshots/8314e79f5bf578c3f197f6956169c1816915afffd19b0d8c13ccdb6effb49296/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/8f40d527d8de3612647281d0ab83da9e2e4f4f1b0ec566a04c54fe753856ad66/contract';
import startContract from '../../snapshots/8f40d527d8de3612647281d0ab83da9e2e4f4f1b0ec566a04c54fe753856ad66/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'bug_report',
        column: col('resolution', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'bug_report',
        constraint: 'bug_report_resolution_check_8950df78',
        expression: `"resolution" IN ('fixed', 'confirmed', 'no_response', 'unconfirmed', 'not_a_bug')`,
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
