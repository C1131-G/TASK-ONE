#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/355cc70312fab7ba7944feadfb00a98a58e6f0fce3cc7aeb0bbd4910b49f0058/contract';
import endContract from '../../snapshots/355cc70312fab7ba7944feadfb00a98a58e6f0fce3cc7aeb0bbd4910b49f0058/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/d970dbfec62663aa9e785a42b265a307512f5a753698f0e8d7505e55fe4d2bea/contract';
import startContract from '../../snapshots/d970dbfec62663aa9e785a42b265a307512f5a753698f0e8d7505e55fe4d2bea/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'bug_fix_attempt',
        column: col('testedEnvironment', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'bug_fix_attempt',
        column: col('testedVersion', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'bug_fix_attempt',
        constraint: 'bug_fix_attempt_testedEnvironment_check_2fa9170a',
        expression: `"testedEnvironment" IN ('production', 'staging', 'development', 'test', 'other')`,
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
