#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/8234c60ca97d43182e7723970645828a27faf1cb2ec609f4da042aae74c5291c/contract';
import endContract from '../../snapshots/8234c60ca97d43182e7723970645828a27faf1cb2ec609f4da042aae74c5291c/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/ac95d16f166f37e55580dbec1c832a96fbf96f663e6bc8f9c1a161969ef63588/contract';
import startContract from '../../snapshots/ac95d16f166f37e55580dbec1c832a96fbf96f663e6bc8f9c1a161969ef63588/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'project',
        column: col('clientVisible', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'task',
        column: col('clientVisible', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
