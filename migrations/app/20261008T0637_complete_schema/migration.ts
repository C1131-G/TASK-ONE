#!/usr/bin/env -S node
import {
  Migration,
  MigrationCLI,
  col,
  lit,
} from "@prisma/orm-postgres/migration";

import type { Contract as End } from "../../snapshots/717a9aad173a9c9ca8971a5bc21c8a7d4885359d12a780edc55b67e2ea906e5f/contract";
import endContract from "../../snapshots/717a9aad173a9c9ca8971a5bc21c8a7d4885359d12a780edc55b67e2ea906e5f/contract.json" with { type: "json" };
import type { Contract as Start } from "../../snapshots/db9fd9559f5920c2ad41f484f9cc74965389590e3d8929e43aae2853919a6c5a/contract";
import startContract from "../../snapshots/db9fd9559f5920c2ad41f484f9cc74965389590e3d8929e43aae2853919a6c5a/contract.json" with { type: "json" };

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        column: col("brandColor", "text", {
          notNull: true,
          default: lit("#1D1C1A"),
          codecRef: { codecId: "pg/text@1" },
        }),
        schema: "public",
        table: "company_settings",
      }),
      this.addColumn({
        column: col("brandEnabled", "bool", {
          notNull: true,
          default: lit(true),
          codecRef: { codecId: "pg/bool@1" },
        }),
        schema: "public",
        table: "company_settings",
      }),
      this.addColumn({
        column: col("slug", "text", {
          notNull: true,
          default: lit("gr8rstudio"),
          codecRef: { codecId: "pg/text@1" },
        }),
        schema: "public",
        table: "company_settings",
      }),
      this.addColumn({
        column: col("assigneeId", "text", {
          codecRef: { codecId: "pg/text@1" },
        }),
        schema: "public",
        table: "task_subtask",
      }),
      this.addColumn({
        column: col("description", "text", {
          codecRef: { codecId: "pg/text@1" },
        }),
        schema: "public",
        table: "task_subtask",
      }),
      this.addColumn({
        column: col("dueDate", "date", {
          codecRef: { codecId: "pg/date-string@1" },
        }),
        schema: "public",
        table: "task_subtask",
      }),
      this.addColumn({
        column: col("deactivatedAt", "timestamptz", {
          codecRef: { codecId: "pg/timestamptz-date@1" },
        }),
        schema: "public",
        table: "user",
      }),
      this.addColumn({
        column: col("deactivatedById", "text", {
          codecRef: { codecId: "pg/text@1" },
        }),
        schema: "public",
        table: "user",
      }),
      this.addCheckConstraint({
        constraint: "calendar_event_end_after_start_1669454c",
        expression: '"endsAt" IS NULL OR "endsAt" >= "startsAt"',
        schema: "public",
        table: "calendar_event",
      }),
      this.addCheckConstraint({
        constraint: "company_settings_singleton_id_52a8a17b",
        expression: "id = 'company'",
        schema: "public",
        table: "company_settings",
      }),
      this.addUnique({
        columns: ["slug"],
        constraint: "company_settings_slug_key",
        schema: "public",
        table: "company_settings",
      }),
      this.addCheckConstraint({
        constraint: "file_asset_size_nonnegative_cff0c8d9",
        expression: '"sizeBytes" >= 0',
        schema: "public",
        table: "file_asset",
      }),
      this.addCheckConstraint({
        constraint: "task_project_number_positive_68c00e77",
        expression: '"projectTaskNumber" > 0',
        schema: "public",
        table: "task",
      }),
      this.addCheckConstraint({
        constraint: "task_dependency_not_self_bb157a38",
        expression: '"taskId" <> "dependsOnTaskId"',
        schema: "public",
        table: "task_dependency",
      }),
      this.addCheckConstraint({
        constraint: "task_recurrence_interval_positive_4915f922",
        expression: '"interval" > 0',
        schema: "public",
        table: "task_recurrence",
      }),
      this.addCheckConstraint({
        constraint: "user_deactivation_fields_paired_68ebd7ec",
        expression:
          '("deactivatedAt" IS NULL AND "deactivatedById" IS NULL) OR ("deactivatedAt" IS NOT NULL AND "deactivatedById" IS NOT NULL)',
        schema: "public",
        table: "user",
      }),
      this.addCheckConstraint({
        constraint: "user_employee_number_positive_e02d95cf",
        expression: '"employeeNumber" > 0',
        schema: "public",
        table: "user",
      }),
      this.createIndex({
        columns: ["assigneeId"],
        index: "task_subtask_assigneeId_idx_fd12ae38",
        schema: "public",
        table: "task_subtask",
      }),
      this.createIndex({
        columns: ["dueDate"],
        index: "task_subtask_dueDate_idx_fb527616",
        schema: "public",
        table: "task_subtask",
      }),
      this.createIndex({
        columns: ["deactivatedAt"],
        index: "user_deactivatedAt_idx_61cfa815",
        schema: "public",
        table: "user",
      }),
      this.createIndex({
        columns: ["deactivatedById"],
        index: "user_deactivatedById_idx_12fe95fd",
        schema: "public",
        table: "user",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["assigneeId"],
          name: "task_subtask_assigneeId_fkey",
          onDelete: "restrict",
          references: { columns: ["id"], schema: "public", table: "user" },
        },
        schema: "public",
        table: "task_subtask",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["deactivatedById"],
          name: "user_deactivatedById_fkey",
          onDelete: "restrict",
          references: { columns: ["id"], schema: "public", table: "user" },
        },
        schema: "public",
        table: "user",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
