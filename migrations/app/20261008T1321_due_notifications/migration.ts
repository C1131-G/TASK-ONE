#!/usr/bin/env -S node
import { Migration, MigrationCLI } from "@prisma/orm-postgres/migration";

import type { Contract as Start } from "../../snapshots/2f74f4bd860a2c434fa9fdf605e570608759df8657616ebe492fc712d7fc00f0/contract";
import startContract from "../../snapshots/2f74f4bd860a2c434fa9fdf605e570608759df8657616ebe492fc712d7fc00f0/contract.json" with { type: "json" };
import type { Contract as End } from "../../snapshots/5425ca2766916b46fbea5cced079653a70a0ff04083e451dcc29bf2809d2466a/contract";
import endContract from "../../snapshots/5425ca2766916b46fbea5cced079653a70a0ff04083e451dcc29bf2809d2466a/contract.json" with { type: "json" };

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        constraint: "notification_type_check_9769ec0e",
        schema: "public",
        table: "notification",
      }),
      this.addCheckConstraint({
        constraint: "notification_type_check_cac43c93",
        expression: `"type" IN ('mention', 'assignment', 'comment', 'update', 'due')`,
        schema: "public",
        table: "notification",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
