#!/usr/bin/env -S node
import { Migration, MigrationCLI, col } from "@prisma/orm-postgres/migration";

import type { Contract as Start } from "../../snapshots/1b5d4b3f64077378fb134a8d3e90a1d9d2e0d89bcfee350966fdd89a339b99f4/contract";
import startContract from "../../snapshots/1b5d4b3f64077378fb134a8d3e90a1d9d2e0d89bcfee350966fdd89a339b99f4/contract.json" with { type: "json" };
import type { Contract as End } from "../../snapshots/fa37d6fd21212afdc05da253043c688008f294217b8b97b17491084d0cffcb2b/contract";
import endContract from "../../snapshots/fa37d6fd21212afdc05da253043c688008f294217b8b97b17491084d0cffcb2b/contract.json" with { type: "json" };

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        column: col("id", "text", { codecRef: { codecId: "pg/text@1" } }),
        schema: "public",
        table: "rateLimit",
      }),
      this.addUnique({
        columns: ["id"],
        constraint: "rateLimit_id_key",
        schema: "public",
        table: "rateLimit",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
