#!/usr/bin/env -S node
import {
  Migration,
  MigrationCLI,
  col,
  primaryKey,
} from "@prisma/orm-postgres/migration";

import type { Contract as End } from "../../snapshots/1b5d4b3f64077378fb134a8d3e90a1d9d2e0d89bcfee350966fdd89a339b99f4/contract";
import endContract from "../../snapshots/1b5d4b3f64077378fb134a8d3e90a1d9d2e0d89bcfee350966fdd89a339b99f4/contract.json" with { type: "json" };
import type { Contract as Start } from "../../snapshots/717a9aad173a9c9ca8971a5bc21c8a7d4885359d12a780edc55b67e2ea906e5f/contract";
import startContract from "../../snapshots/717a9aad173a9c9ca8971a5bc21c8a7d4885359d12a780edc55b67e2ea906e5f/contract.json" with { type: "json" };

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        columns: [
          col("count", "int4", {
            notNull: true,
            codecRef: { codecId: "pg/int4@1" },
          }),
          col("key", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("lastRequest", "int8", {
            notNull: true,
            codecRef: { codecId: "pg/int8@1" },
          }),
        ],
        constraints: [primaryKey(["key"])],
        schema: "public",
        table: "rateLimit",
      }),
      this.addColumn({
        column: col("emailNormalized", "text", {
          codecRef: { codecId: "pg/text@1" },
        }),
        schema: "public",
        table: "user",
      }),
      this.addUnique({
        columns: ["emailNormalized"],
        constraint: "user_emailNormalized_key",
        schema: "public",
        table: "user",
      }),
      this.createIndex({
        columns: ["lastRequest"],
        index: "rateLimit_lastRequest_idx_e5c9beaa",
        schema: "public",
        table: "rateLimit",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
