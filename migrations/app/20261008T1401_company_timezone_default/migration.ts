#!/usr/bin/env -S node
import {
  Migration,
  MigrationCLI,
  col,
  lit,
} from "@prisma/orm-postgres/migration";

import type { Contract as Start } from "../../snapshots/58bb47aaaffa307e7b35aa1ceb1de179297660ae47a700b7d42f5dfcda04e40a/contract";
import startContract from "../../snapshots/58bb47aaaffa307e7b35aa1ceb1de179297660ae47a700b7d42f5dfcda04e40a/contract.json" with { type: "json" };
import type { Contract as End } from "../../snapshots/e4527d00558f872a369d4ec2fabac4edd010594a767dfc4b2ccd5e92600f8021/contract";
import endContract from "../../snapshots/e4527d00558f872a369d4ec2fabac4edd010594a767dfc4b2ccd5e92600f8021/contract.json" with { type: "json" };

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.setDefault({
        column: col("timeZone", "text", {
          default: lit("Asia/Kolkata"),
          codecRef: { codecId: "pg/text@1" },
        }),
        operationClass: "widening",
        schema: "public",
        table: "company_settings",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
