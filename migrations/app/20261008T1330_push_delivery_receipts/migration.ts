#!/usr/bin/env -S node
import {
  Migration,
  MigrationCLI,
  col,
  fn,
  primaryKey,
} from "@prisma/orm-postgres/migration";

import type { Contract as Start } from "../../snapshots/17d6e56921b8d06f72fc3ab840e0b3e85ec7861d99dd2e29ff1645274390c375/contract";
import startContract from "../../snapshots/17d6e56921b8d06f72fc3ab840e0b3e85ec7861d99dd2e29ff1645274390c375/contract.json" with { type: "json" };
import type { Contract as End } from "../../snapshots/58bb47aaaffa307e7b35aa1ceb1de179297660ae47a700b7d42f5dfcda04e40a/contract";
import endContract from "../../snapshots/58bb47aaaffa307e7b35aa1ceb1de179297660ae47a700b7d42f5dfcda04e40a/contract.json" with { type: "json" };

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        columns: [
          col("createdAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("deliveredAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("endpointHash", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("id", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("notificationId", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("userId", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
        ],
        constraints: [primaryKey(["id"])],
        schema: "public",
        table: "push_delivery",
      }),
      this.addUnique({
        columns: ["notificationId", "userId", "endpointHash"],
        constraint: "push_delivery_notificationId_userId_endpointHash_key",
        schema: "public",
        table: "push_delivery",
      }),
      this.createIndex({
        columns: ["userId", "deliveredAt"],
        index: "push_delivery_userId_deliveredAt_idx_c60c106a",
        schema: "public",
        table: "push_delivery",
      }),
      this.createIndex({
        columns: ["userId"],
        index: "push_delivery_userId_idx_a489d58a",
        schema: "public",
        table: "push_delivery",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["userId"],
          name: "push_delivery_userId_fkey",
          onDelete: "restrict",
          references: { columns: ["id"], schema: "public", table: "user" },
        },
        schema: "public",
        table: "push_delivery",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
