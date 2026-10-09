#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/7e3ecb92acdb436c18b9f4a11e952c59156c5c16fa8f6dba04cab511c5ffc61a/contract';
import endContract from '../../snapshots/7e3ecb92acdb436c18b9f4a11e952c59156c5c16fa8f6dba04cab511c5ffc61a/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e4527d00558f872a369d4ec2fabac4edd010594a767dfc4b2ccd5e92600f8021/contract';
import startContract from '../../snapshots/e4527d00558f872a369d4ec2fabac4edd010594a767dfc4b2ccd5e92600f8021/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'job',
        column: col('leaseToken', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
