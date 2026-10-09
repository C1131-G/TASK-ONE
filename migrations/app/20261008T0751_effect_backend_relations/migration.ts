#!/usr/bin/env -S node
import { Migration, MigrationCLI } from "@prisma/orm-postgres/migration";

import type { Contract as End } from "../../snapshots/2f74f4bd860a2c434fa9fdf605e570608759df8657616ebe492fc712d7fc00f0/contract";
import endContract from "../../snapshots/2f74f4bd860a2c434fa9fdf605e570608759df8657616ebe492fc712d7fc00f0/contract.json" with { type: "json" };
import type { Contract as Start } from "../../snapshots/7db49f8cee55ee82c1df819c920ddd49f980320bc8c697f71fc5cef19fa16ae9/contract";
import startContract from "../../snapshots/7db49f8cee55ee82c1df819c920ddd49f980320bc8c697f71fc5cef19fa16ae9/contract.json" with { type: "json" };

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createIndex({
        columns: ["projectId"],
        index: "upload_intent_projectId_idx_a96e4d92",
        schema: "public",
        table: "upload_intent",
      }),
      this.createIndex({
        columns: ["taskId"],
        index: "upload_intent_taskId_idx_4965c936",
        schema: "public",
        table: "upload_intent",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["projectId"],
          name: "project_task_counter_projectId_fkey",
          onDelete: "cascade",
          references: { columns: ["id"], schema: "public", table: "project" },
        },
        schema: "public",
        table: "project_task_counter",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["sourceTaskId"],
          name: "recurrence_generation_sourceTaskId_fkey",
          onDelete: "restrict",
          references: { columns: ["id"], schema: "public", table: "task" },
        },
        schema: "public",
        table: "recurrence_generation",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["successorTaskId"],
          name: "recurrence_generation_successorTaskId_fkey",
          onDelete: "restrict",
          references: { columns: ["id"], schema: "public", table: "task" },
        },
        schema: "public",
        table: "recurrence_generation",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["projectId"],
          name: "upload_intent_projectId_fkey",
          onDelete: "restrict",
          references: { columns: ["id"], schema: "public", table: "project" },
        },
        schema: "public",
        table: "upload_intent",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["taskId"],
          name: "upload_intent_taskId_fkey",
          onDelete: "restrict",
          references: { columns: ["id"], schema: "public", table: "task" },
        },
        schema: "public",
        table: "upload_intent",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
