#!/usr/bin/env -S node
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from "@prisma/orm-postgres/migration";

import type { Contract as End } from "../../snapshots/7db49f8cee55ee82c1df819c920ddd49f980320bc8c697f71fc5cef19fa16ae9/contract";
import endContract from "../../snapshots/7db49f8cee55ee82c1df819c920ddd49f980320bc8c697f71fc5cef19fa16ae9/contract.json" with { type: "json" };
import type { Contract as Start } from "../../snapshots/fa37d6fd21212afdc05da253043c688008f294217b8b97b17491084d0cffcb2b/contract";
import startContract from "../../snapshots/fa37d6fd21212afdc05da253043c688008f294217b8b97b17491084d0cffcb2b/contract.json" with { type: "json" };

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        columns: [
          col("actorId", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("createdAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("expiresAt", "timestamptz", {
            notNull: true,
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("id", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("key", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("requestHash", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("response", "json", { codecRef: { codecId: "pg/json@1" } }),
        ],
        constraints: [primaryKey(["id"])],
        schema: "public",
        table: "idempotency_key",
      }),
      this.createTable({
        columns: [
          col("attempts", "int4", {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: "pg/int4@1" },
          }),
          col("availableAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("completedAt", "timestamptz", {
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("createdAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("deadAt", "timestamptz", {
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("dedupeKey", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("id", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("kind", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("lastError", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("leaseOwner", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("leasedUntil", "timestamptz", {
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("maxAttempts", "int4", {
            notNull: true,
            default: lit(8),
            codecRef: { codecId: "pg/int4@1" },
          }),
          col("payload", "json", {
            notNull: true,
            codecRef: { codecId: "pg/json@1" },
          }),
          col("updatedAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
        ],
        constraints: [primaryKey(["id"])],
        schema: "public",
        table: "job",
      }),
      this.createTable({
        columns: [
          col("nextNumber", "int4", {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: "pg/int4@1" },
          }),
          col("projectId", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("updatedAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
        ],
        constraints: [
          primaryKey(["projectId"]),
          checkExpression(
            "project_task_counter_positive_cb660188",
            '"nextNumber" > 0'
          ),
        ],
        schema: "public",
        table: "project_task_counter",
      }),
      this.createTable({
        columns: [
          col("createdAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("endpoint", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("id", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("keys", "json", {
            notNull: true,
            codecRef: { codecId: "pg/json@1" },
          }),
          col("updatedAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("userAgent", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("userId", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
        ],
        constraints: [primaryKey(["id"])],
        schema: "public",
        table: "push_subscription",
      }),
      this.createTable({
        columns: [
          col("createdAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("generationKey", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("id", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("sourceTaskId", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("successorTaskId", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
        ],
        constraints: [primaryKey(["id"])],
        schema: "public",
        table: "recurrence_generation",
      }),
      this.createTable({
        columns: [
          col("action", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("actorId", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("consumedAt", "timestamptz", {
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("createdAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("entityId", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("entityType", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("expiresAt", "timestamptz", {
            notNull: true,
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("id", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("snapshot", "json", {
            notNull: true,
            codecRef: { codecId: "pg/json@1" },
          }),
        ],
        constraints: [primaryKey(["id"])],
        schema: "public",
        table: "undo_record",
      }),
      this.createTable({
        columns: [
          col("contentType", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("createdAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("expiresAt", "timestamptz", {
            notNull: true,
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("fileName", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("finalizedAt", "timestamptz", {
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("id", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("objectKey", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("ownerId", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("projectId", "uuid", { codecRef: { codecId: "pg/uuid@1" } }),
          col("removedAt", "timestamptz", {
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("sizeBytes", "int8", {
            notNull: true,
            codecRef: { codecId: "pg/int8@1" },
          }),
          col("state", "text", {
            notNull: true,
            default: lit("pending"),
            codecRef: { codecId: "pg/text@1" },
          }),
          col("taskId", "uuid", { codecRef: { codecId: "pg/uuid@1" } }),
          col("updatedAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
        ],
        constraints: [
          primaryKey(["id"]),
          checkExpression(
            "upload_size_valid_ac56015b",
            '"sizeBytes" > 0 AND "sizeBytes" <= 52428800'
          ),
          checkExpression(
            "upload_state_valid_f79005c7",
            "state IN ('pending', 'finalized', 'failed', 'removed')"
          ),
        ],
        schema: "public",
        table: "upload_intent",
      }),
      this.addColumn({
        column: col("version", "int4", {
          notNull: true,
          default: lit(1),
          codecRef: { codecId: "pg/int4@1" },
        }),
        schema: "public",
        table: "project",
      }),
      this.addColumn({
        column: col("version", "int4", {
          notNull: true,
          default: lit(1),
          codecRef: { codecId: "pg/int4@1" },
        }),
        schema: "public",
        table: "task",
      }),
      this.addUnique({
        columns: ["actorId", "key"],
        constraint: "idempotency_key_actorId_key_key",
        schema: "public",
        table: "idempotency_key",
      }),
      this.addUnique({
        columns: ["dedupeKey"],
        constraint: "job_dedupeKey_key",
        schema: "public",
        table: "job",
      }),
      this.addUnique({
        columns: ["endpoint"],
        constraint: "push_subscription_endpoint_key",
        schema: "public",
        table: "push_subscription",
      }),
      this.addUnique({
        columns: ["successorTaskId"],
        constraint: "recurrence_generation_successorTaskId_key",
        schema: "public",
        table: "recurrence_generation",
      }),
      this.addUnique({
        columns: ["generationKey"],
        constraint: "recurrence_generation_generationKey_key",
        schema: "public",
        table: "recurrence_generation",
      }),
      this.addUnique({
        columns: ["objectKey"],
        constraint: "upload_intent_objectKey_key",
        schema: "public",
        table: "upload_intent",
      }),
      this.createIndex({
        columns: ["actorId"],
        index: "idempotency_key_actorId_idx_a58f6b4b",
        schema: "public",
        table: "idempotency_key",
      }),
      this.createIndex({
        columns: ["expiresAt"],
        index: "idempotency_key_expiresAt_idx_6b6b8c10",
        schema: "public",
        table: "idempotency_key",
      }),
      this.createIndex({
        columns: ["availableAt", "leasedUntil", "completedAt", "deadAt"],
        index: "job_availableAt_leasedUntil_completedAt_deadAt_idx_69cc2ae0",
        schema: "public",
        table: "job",
      }),
      this.createIndex({
        columns: ["leaseOwner", "leasedUntil"],
        index: "job_leaseOwner_leasedUntil_idx_a51039dd",
        schema: "public",
        table: "job",
      }),
      this.createIndex({
        columns: ["userId"],
        index: "push_subscription_userId_idx_a489d58a",
        schema: "public",
        table: "push_subscription",
      }),
      this.createIndex({
        columns: ["sourceTaskId"],
        index: "recurrence_generation_sourceTaskId_idx_e6290971",
        schema: "public",
        table: "recurrence_generation",
      }),
      this.createIndex({
        columns: ["actorId", "expiresAt", "consumedAt"],
        index: "undo_record_actorId_expiresAt_consumedAt_idx_0a8a75a4",
        schema: "public",
        table: "undo_record",
      }),
      this.createIndex({
        columns: ["actorId"],
        index: "undo_record_actorId_idx_a58f6b4b",
        schema: "public",
        table: "undo_record",
      }),
      this.createIndex({
        columns: ["entityType", "entityId"],
        index: "undo_record_entityType_entityId_idx_ea0fa809",
        schema: "public",
        table: "undo_record",
      }),
      this.createIndex({
        columns: ["expiresAt", "state"],
        index: "upload_intent_expiresAt_state_idx_47121f95",
        schema: "public",
        table: "upload_intent",
      }),
      this.createIndex({
        columns: ["ownerId"],
        index: "upload_intent_ownerId_idx_e2d0c1ef",
        schema: "public",
        table: "upload_intent",
      }),
      this.createIndex({
        columns: ["ownerId", "state", "createdAt"],
        index: "upload_intent_ownerId_state_createdAt_idx_9ce082d2",
        schema: "public",
        table: "upload_intent",
      }),
      this.createIndex({
        columns: ["projectId", "state"],
        index: "upload_intent_projectId_state_idx_cea2771c",
        schema: "public",
        table: "upload_intent",
      }),
      this.createIndex({
        columns: ["taskId", "state"],
        index: "upload_intent_taskId_state_idx_e8b19231",
        schema: "public",
        table: "upload_intent",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["actorId"],
          name: "idempotency_key_actorId_fkey",
          onDelete: "restrict",
          references: { columns: ["id"], schema: "public", table: "user" },
        },
        schema: "public",
        table: "idempotency_key",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["userId"],
          name: "push_subscription_userId_fkey",
          onDelete: "cascade",
          references: { columns: ["id"], schema: "public", table: "user" },
        },
        schema: "public",
        table: "push_subscription",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["actorId"],
          name: "undo_record_actorId_fkey",
          onDelete: "restrict",
          references: { columns: ["id"], schema: "public", table: "user" },
        },
        schema: "public",
        table: "undo_record",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["ownerId"],
          name: "upload_intent_ownerId_fkey",
          onDelete: "restrict",
          references: { columns: ["id"], schema: "public", table: "user" },
        },
        schema: "public",
        table: "upload_intent",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
