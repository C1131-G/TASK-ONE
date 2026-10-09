#!/usr/bin/env -S node
import {
  Migration,
  MigrationCLI,
  col,
  lit,
} from "@prisma/orm-postgres/migration";

import type { Contract as End } from "../../snapshots/17d6e56921b8d06f72fc3ab840e0b3e85ec7861d99dd2e29ff1645274390c375/contract";
import endContract from "../../snapshots/17d6e56921b8d06f72fc3ab840e0b3e85ec7861d99dd2e29ff1645274390c375/contract.json" with { type: "json" };
import type { Contract as Start } from "../../snapshots/5425ca2766916b46fbea5cced079653a70a0ff04083e451dcc29bf2809d2466a/contract";
import startContract from "../../snapshots/5425ca2766916b46fbea5cced079653a70a0ff04083e451dcc29bf2809d2466a/contract.json" with { type: "json" };

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        column: col("copyError", "text", {
          codecRef: { codecId: "pg/text@1" },
        }),
        schema: "public",
        table: "file_asset",
      }),
      this.addColumn({
        column: col("copyState", "text", {
          notNull: true,
          default: lit("ready"),
          codecRef: { codecId: "pg/text@1" },
        }),
        schema: "public",
        table: "file_asset",
      }),
      this.addCheckConstraint({
        constraint: "file_asset_copy_state_valid_08b2bfa7",
        expression: `"copyState" IN ('pending', 'ready', 'failed')`,
        schema: "public",
        table: "file_asset",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
