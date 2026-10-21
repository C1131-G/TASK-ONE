#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/3e713382f93ef90aed7ac12d94e199668022017aae9b3e4f2bc1180c7a4fe6d6/contract';
import startContract from '../../snapshots/3e713382f93ef90aed7ac12d94e199668022017aae9b3e4f2bc1180c7a4fe6d6/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e7b1156b738c8d25360fcb7707ac099494c734290b5f24b863edb6e9e67379c2/contract';
import endContract from '../../snapshots/e7b1156b738c8d25360fcb7707ac099494c734290b5f24b863edb6e9e67379c2/contract.json' with { type: 'json' };
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
