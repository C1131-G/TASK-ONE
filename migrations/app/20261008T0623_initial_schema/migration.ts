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

import type { Contract as End } from "../../snapshots/db9fd9559f5920c2ad41f484f9cc74965389590e3d8929e43aae2853919a6c5a/contract";
import endContract from "../../snapshots/db9fd9559f5920c2ad41f484f9cc74965389590e3d8929e43aae2853919a6c5a/contract.json" with { type: "json" };

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: "public" }),
      this.createTable({
        columns: [
          col("accessToken", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("accessTokenExpiresAt", "timestamptz", {
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("accountId", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("createdAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("id", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("idToken", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("password", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("providerId", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("refreshToken", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("refreshTokenExpiresAt", "timestamptz", {
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("scope", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("updatedAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("userId", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
        ],
        constraints: [primaryKey(["id"])],
        schema: "public",
        table: "account",
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
          col("createdAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("details", "jsonb", { codecRef: { codecId: "pg/jsonb@1" } }),
          col("id", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("projectId", "uuid", { codecRef: { codecId: "pg/uuid@1" } }),
          col("taskId", "uuid", { codecRef: { codecId: "pg/uuid@1" } }),
        ],
        constraints: [primaryKey(["id"])],
        schema: "public",
        table: "activity",
      }),
      this.createTable({
        columns: [
          col("createdAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("createdById", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("description", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("endsAt", "timestamptz", {
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("id", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("location", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("projectId", "uuid", { codecRef: { codecId: "pg/uuid@1" } }),
          col("startsAt", "timestamptz", {
            notNull: true,
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("title", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("updatedAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
        ],
        constraints: [primaryKey(["id"])],
        schema: "public",
        table: "calendar_event",
      }),
      this.createTable({
        columns: [
          col("createdAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("eventId", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("userId", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
        ],
        constraints: [primaryKey(["eventId", "userId"])],
        schema: "public",
        table: "calendar_event_attendee",
      }),
      this.createTable({
        columns: [
          col("authorId", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("body", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("createdAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("deletedAt", "timestamptz", {
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("deletedById", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("id", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("taskId", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("updatedAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
        ],
        constraints: [primaryKey(["id"])],
        schema: "public",
        table: "comment",
      }),
      this.createTable({
        columns: [
          col("commentId", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("createdAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("emoji", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("userId", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
        ],
        constraints: [primaryKey(["commentId", "userId", "emoji"])],
        schema: "public",
        table: "comment_reaction",
      }),
      this.createTable({
        columns: [
          col("id", "text", {
            notNull: true,
            default: lit("company"),
            codecRef: { codecId: "pg/text@1" },
          }),
          col("name", "text", {
            notNull: true,
            default: lit("Gr8r Studio"),
            codecRef: { codecId: "pg/text@1" },
          }),
          col("settings", "jsonb", {
            notNull: true,
            default: lit({}),
            codecRef: { codecId: "pg/jsonb@1" },
          }),
          col("timeZone", "text", {
            notNull: true,
            default: lit("UTC"),
            codecRef: { codecId: "pg/text@1" },
          }),
          col("updatedAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
        ],
        constraints: [primaryKey(["id"])],
        schema: "public",
        table: "company_settings",
      }),
      this.createTable({
        columns: [
          col("createdAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("projectId", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("userId", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
        ],
        constraints: [primaryKey(["userId", "projectId"])],
        schema: "public",
        table: "favorite_project",
      }),
      this.createTable({
        columns: [
          col("createdAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("taskId", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("userId", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
        ],
        constraints: [primaryKey(["userId", "taskId"])],
        schema: "public",
        table: "favorite_task",
      }),
      this.createTable({
        columns: [
          col("contentType", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("createdAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("deletedAt", "timestamptz", {
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("deletedById", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("id", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("originalName", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("projectId", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("sizeBytes", "int8", {
            notNull: true,
            codecRef: { codecId: "pg/int8@1" },
          }),
          col("storageKey", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("taskId", "uuid", { codecRef: { codecId: "pg/uuid@1" } }),
          col("uploadedById", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
        ],
        constraints: [primaryKey(["id"])],
        schema: "public",
        table: "file_asset",
      }),
      this.createTable({
        columns: [
          col("color", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("createdAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("id", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("name", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
        ],
        constraints: [primaryKey(["id"])],
        schema: "public",
        table: "label",
      }),
      this.createTable({
        columns: [
          col("actorId", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("createdAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("id", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("projectId", "uuid", { codecRef: { codecId: "pg/uuid@1" } }),
          col("readAt", "timestamptz", {
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("snippet", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("taskId", "uuid", { codecRef: { codecId: "pg/uuid@1" } }),
          col("text", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("type", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("userId", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
        ],
        constraints: [
          primaryKey(["id"]),
          checkExpression(
            "notification_type_check_9769ec0e",
            `"type" IN ('mention', 'assignment', 'comment', 'update')`
          ),
        ],
        schema: "public",
        table: "notification",
      }),
      this.createTable({
        columns: [
          col("channel", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("enabled", "bool", {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: "pg/bool@1" },
          }),
          col("eventType", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("id", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("updatedAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("userId", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
        ],
        constraints: [primaryKey(["id"])],
        schema: "public",
        table: "notification_preference",
      }),
      this.createTable({
        columns: [
          col("archivedAt", "timestamptz", {
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("archivedById", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("color", "text", {
            notNull: true,
            default: lit("slate"),
            codecRef: { codecId: "pg/text@1" },
          }),
          col("createdAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("description", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("dueDate", "date", { codecRef: { codecId: "pg/date-string@1" } }),
          col("icon", "text", {
            notNull: true,
            default: lit("folder"),
            codecRef: { codecId: "pg/text@1" },
          }),
          col("id", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("key", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("leadId", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("name", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("position", "int4", {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: "pg/int4@1" },
          }),
          col("startDate", "date", {
            codecRef: { codecId: "pg/date-string@1" },
          }),
          col("status", "text", {
            notNull: true,
            default: lit("planning"),
            codecRef: { codecId: "pg/text@1" },
          }),
          col("teamId", "uuid", { codecRef: { codecId: "pg/uuid@1" } }),
          col("updatedAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
        ],
        constraints: [
          primaryKey(["id"]),
          checkExpression(
            "project_status_check_6a38622b",
            `"status" IN ('planning', 'active', 'risk', 'hold', 'complete')`
          ),
        ],
        schema: "public",
        table: "project",
      }),
      this.createTable({
        columns: [
          col("joinedAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("projectId", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("userId", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
        ],
        constraints: [primaryKey(["projectId", "userId"])],
        schema: "public",
        table: "project_member",
      }),
      this.createTable({
        columns: [
          col("completedAt", "timestamptz", {
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("createdAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("dueDate", "date", { codecRef: { codecId: "pg/date-string@1" } }),
          col("id", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("name", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("position", "int4", {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: "pg/int4@1" },
          }),
          col("projectId", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
        ],
        constraints: [primaryKey(["id"])],
        schema: "public",
        table: "project_milestone",
      }),
      this.createTable({
        columns: [
          col("id", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("query", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("searchedAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("userId", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
        ],
        constraints: [primaryKey(["id"])],
        schema: "public",
        table: "recent_search",
      }),
      this.createTable({
        columns: [
          col("createdAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("filters", "jsonb", {
            notNull: true,
            default: lit([]),
            codecRef: { codecId: "pg/jsonb@1" },
          }),
          col("groupBy", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("hiddenColumns", "jsonb", {
            notNull: true,
            default: lit([]),
            codecRef: { codecId: "pg/jsonb@1" },
          }),
          col("id", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("isShared", "bool", {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: "pg/bool@1" },
          }),
          col("name", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("projectId", "uuid", { codecRef: { codecId: "pg/uuid@1" } }),
          col("sort", "jsonb", {
            notNull: true,
            default: lit({}),
            codecRef: { codecId: "pg/jsonb@1" },
          }),
          col("type", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("updatedAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("userId", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
        ],
        constraints: [
          primaryKey(["id"]),
          checkExpression(
            "saved_view_type_check_422226e3",
            `"type" IN ('board', 'list', 'table', 'calendar', 'timeline')`
          ),
        ],
        schema: "public",
        table: "saved_view",
      }),
      this.createTable({
        columns: [
          col("createdAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("expiresAt", "timestamptz", {
            notNull: true,
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("id", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("impersonatedBy", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("ipAddress", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("token", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
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
        table: "session",
      }),
      this.createTable({
        columns: [
          col("archivedAt", "timestamptz", {
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("archivedById", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("completedAt", "timestamptz", {
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("createdAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("createdById", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("description", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("dueDate", "date", { codecRef: { codecId: "pg/date-string@1" } }),
          col("estimate", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("id", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("position", "float8", {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: "pg/float8@1" },
          }),
          col("priority", "text", {
            notNull: true,
            default: lit("none"),
            codecRef: { codecId: "pg/text@1" },
          }),
          col("projectId", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("projectTaskNumber", "int4", {
            notNull: true,
            codecRef: { codecId: "pg/int4@1" },
          }),
          col("startDate", "date", {
            codecRef: { codecId: "pg/date-string@1" },
          }),
          col("status", "text", {
            notNull: true,
            default: lit("todo"),
            codecRef: { codecId: "pg/text@1" },
          }),
          col("title", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("updatedAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
        ],
        constraints: [
          primaryKey(["id"]),
          checkExpression(
            "task_priority_check_50cc6a72",
            `"priority" IN ('urgent', 'high', 'medium', 'low', 'none')`
          ),
          checkExpression(
            "task_status_check_3309391b",
            `"status" IN ('backlog', 'todo', 'progress', 'review', 'done')`
          ),
        ],
        schema: "public",
        table: "task",
      }),
      this.createTable({
        columns: [
          col("assignedAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("assignedById", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("taskId", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("userId", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
        ],
        constraints: [primaryKey(["taskId", "userId"])],
        schema: "public",
        table: "task_assignee",
      }),
      this.createTable({
        columns: [
          col("createdAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("dependsOnTaskId", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("taskId", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
        ],
        constraints: [primaryKey(["taskId", "dependsOnTaskId"])],
        schema: "public",
        table: "task_dependency",
      }),
      this.createTable({
        columns: [
          col("labelId", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("taskId", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
        ],
        constraints: [primaryKey(["taskId", "labelId"])],
        schema: "public",
        table: "task_label",
      }),
      this.createTable({
        columns: [
          col("createdAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("endsOn", "date", { codecRef: { codecId: "pg/date-string@1" } }),
          col("frequency", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("id", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("interval", "int4", {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: "pg/int4@1" },
          }),
          col("nextRunAt", "date", {
            codecRef: { codecId: "pg/date-string@1" },
          }),
          col("taskId", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("updatedAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("weekDays", "jsonb", { codecRef: { codecId: "pg/jsonb@1" } }),
        ],
        constraints: [
          primaryKey(["id"]),
          checkExpression(
            "task_recurrence_frequency_check_e44b28ab",
            `"frequency" IN ('daily', 'weekly', 'biweekly', 'monthly')`
          ),
        ],
        schema: "public",
        table: "task_recurrence",
      }),
      this.createTable({
        columns: [
          col("completedAt", "timestamptz", {
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("createdAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("id", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("isCompleted", "bool", {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: "pg/bool@1" },
          }),
          col("position", "int4", {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: "pg/int4@1" },
          }),
          col("taskId", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("title", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
        ],
        constraints: [primaryKey(["id"])],
        schema: "public",
        table: "task_subtask",
      }),
      this.createTable({
        columns: [
          col("color", "text", {
            notNull: true,
            default: lit("#8A867E"),
            codecRef: { codecId: "pg/text@1" },
          }),
          col("createdAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("description", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("icon", "text", {
            notNull: true,
            default: lit("users"),
            codecRef: { codecId: "pg/text@1" },
          }),
          col("id", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("name", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("updatedAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
        ],
        constraints: [primaryKey(["id"])],
        schema: "public",
        table: "team",
      }),
      this.createTable({
        columns: [
          col("banExpires", "timestamptz", {
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("banReason", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("banned", "bool", {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: "pg/bool@1" },
          }),
          col("createdAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("email", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("emailVerified", "bool", {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: "pg/bool@1" },
          }),
          col("employeeNumber", "SERIAL", {
            notNull: true,
            codecRef: { codecId: "pg/int4@1" },
          }),
          col("id", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("image", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("jobTitle", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("mustChangePassword", "bool", {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: "pg/bool@1" },
          }),
          col("name", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("role", "text", {
            notNull: true,
            default: lit("employee"),
            codecRef: { codecId: "pg/text@1" },
          }),
          col("teamId", "uuid", { codecRef: { codecId: "pg/uuid@1" } }),
          col("timeZone", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("updatedAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
        ],
        constraints: [
          primaryKey(["id"]),
          checkExpression(
            "user_role_valid_2461e6a1",
            "role IN ('admin', 'employee')"
          ),
        ],
        schema: "public",
        table: "user",
      }),
      this.createTable({
        columns: [
          col("id", "uuid", {
            notNull: true,
            codecRef: { codecId: "pg/uuid@1" },
          }),
          col("key", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("updatedAt", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("userId", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("value", "jsonb", {
            notNull: true,
            codecRef: { codecId: "pg/jsonb@1" },
          }),
        ],
        constraints: [primaryKey(["id"])],
        schema: "public",
        table: "user_preference",
      }),
      this.createTable({
        columns: [
          col("createdAt", "timestamptz", {
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("expiresAt", "timestamptz", {
            notNull: true,
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("id", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("identifier", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
          col("updatedAt", "timestamptz", {
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-date@1" },
          }),
          col("value", "text", {
            notNull: true,
            codecRef: { codecId: "pg/text@1" },
          }),
        ],
        constraints: [primaryKey(["id"])],
        schema: "public",
        table: "verification",
      }),
      this.addUnique({
        columns: ["providerId", "accountId"],
        constraint: "account_providerId_accountId_key",
        schema: "public",
        table: "account",
      }),
      this.addUnique({
        columns: ["storageKey"],
        constraint: "file_asset_storageKey_key",
        schema: "public",
        table: "file_asset",
      }),
      this.addUnique({
        columns: ["name"],
        constraint: "label_name_key",
        schema: "public",
        table: "label",
      }),
      this.addUnique({
        columns: ["userId", "channel", "eventType"],
        constraint: "notification_preference_userId_channel_eventType_key",
        schema: "public",
        table: "notification_preference",
      }),
      this.addUnique({
        columns: ["key"],
        constraint: "project_key_key",
        schema: "public",
        table: "project",
      }),
      this.addUnique({
        columns: ["token"],
        constraint: "session_token_key",
        schema: "public",
        table: "session",
      }),
      this.addUnique({
        columns: ["projectId", "projectTaskNumber"],
        constraint: "task_projectId_projectTaskNumber_key",
        schema: "public",
        table: "task",
      }),
      this.addUnique({
        columns: ["taskId"],
        constraint: "task_recurrence_taskId_key",
        schema: "public",
        table: "task_recurrence",
      }),
      this.addUnique({
        columns: ["name"],
        constraint: "team_name_key",
        schema: "public",
        table: "team",
      }),
      this.addUnique({
        columns: ["email"],
        constraint: "user_email_key",
        schema: "public",
        table: "user",
      }),
      this.addUnique({
        columns: ["employeeNumber"],
        constraint: "user_employeeNumber_key",
        schema: "public",
        table: "user",
      }),
      this.addUnique({
        columns: ["userId", "key"],
        constraint: "user_preference_userId_key_key",
        schema: "public",
        table: "user_preference",
      }),
      this.createIndex({
        columns: ["userId"],
        index: "account_userId_idx_a489d58a",
        schema: "public",
        table: "account",
      }),
      this.createIndex({
        columns: ["actorId", "createdAt"],
        index: "activity_actorId_createdAt_idx_0e9f1adf",
        schema: "public",
        table: "activity",
      }),
      this.createIndex({
        columns: ["actorId"],
        index: "activity_actorId_idx_a58f6b4b",
        schema: "public",
        table: "activity",
      }),
      this.createIndex({
        columns: ["createdAt"],
        index: "activity_createdAt_idx_9575dbd7",
        schema: "public",
        table: "activity",
      }),
      this.createIndex({
        columns: ["projectId", "createdAt"],
        index: "activity_projectId_createdAt_idx_d2d6484f",
        schema: "public",
        table: "activity",
      }),
      this.createIndex({
        columns: ["projectId"],
        index: "activity_projectId_idx_a96e4d92",
        schema: "public",
        table: "activity",
      }),
      this.createIndex({
        columns: ["taskId", "createdAt"],
        index: "activity_taskId_createdAt_idx_f41547ff",
        schema: "public",
        table: "activity",
      }),
      this.createIndex({
        columns: ["taskId"],
        index: "activity_taskId_idx_4965c936",
        schema: "public",
        table: "activity",
      }),
      this.createIndex({
        columns: ["createdById"],
        index: "calendar_event_createdById_idx_8bf640ed",
        schema: "public",
        table: "calendar_event",
      }),
      this.createIndex({
        columns: ["projectId"],
        index: "calendar_event_projectId_idx_a96e4d92",
        schema: "public",
        table: "calendar_event",
      }),
      this.createIndex({
        columns: ["projectId", "startsAt"],
        index: "calendar_event_projectId_startsAt_idx_f24326de",
        schema: "public",
        table: "calendar_event",
      }),
      this.createIndex({
        columns: ["startsAt"],
        index: "calendar_event_startsAt_idx_5ff0df68",
        schema: "public",
        table: "calendar_event",
      }),
      this.createIndex({
        columns: ["eventId"],
        index: "calendar_event_attendee_eventId_idx_6a266d47",
        schema: "public",
        table: "calendar_event_attendee",
      }),
      this.createIndex({
        columns: ["userId"],
        index: "calendar_event_attendee_userId_idx_a489d58a",
        schema: "public",
        table: "calendar_event_attendee",
      }),
      this.createIndex({
        columns: ["authorId"],
        index: "comment_authorId_idx_e47547ed",
        schema: "public",
        table: "comment",
      }),
      this.createIndex({
        columns: ["deletedById"],
        index: "comment_deletedById_idx_6409fd1e",
        schema: "public",
        table: "comment",
      }),
      this.createIndex({
        columns: ["taskId", "createdAt"],
        index: "comment_taskId_createdAt_idx_f41547ff",
        schema: "public",
        table: "comment",
      }),
      this.createIndex({
        columns: ["taskId"],
        index: "comment_taskId_idx_4965c936",
        schema: "public",
        table: "comment",
      }),
      this.createIndex({
        columns: ["commentId"],
        index: "comment_reaction_commentId_idx_b5a4f615",
        schema: "public",
        table: "comment_reaction",
      }),
      this.createIndex({
        columns: ["userId"],
        index: "comment_reaction_userId_idx_a489d58a",
        schema: "public",
        table: "comment_reaction",
      }),
      this.createIndex({
        columns: ["projectId"],
        index: "favorite_project_projectId_idx_a96e4d92",
        schema: "public",
        table: "favorite_project",
      }),
      this.createIndex({
        columns: ["userId"],
        index: "favorite_project_userId_idx_a489d58a",
        schema: "public",
        table: "favorite_project",
      }),
      this.createIndex({
        columns: ["taskId"],
        index: "favorite_task_taskId_idx_4965c936",
        schema: "public",
        table: "favorite_task",
      }),
      this.createIndex({
        columns: ["userId"],
        index: "favorite_task_userId_idx_a489d58a",
        schema: "public",
        table: "favorite_task",
      }),
      this.createIndex({
        columns: ["deletedById"],
        index: "file_asset_deletedById_idx_6409fd1e",
        schema: "public",
        table: "file_asset",
      }),
      this.createIndex({
        columns: ["projectId", "createdAt"],
        index: "file_asset_projectId_createdAt_idx_d2d6484f",
        schema: "public",
        table: "file_asset",
      }),
      this.createIndex({
        columns: ["projectId"],
        index: "file_asset_projectId_idx_a96e4d92",
        schema: "public",
        table: "file_asset",
      }),
      this.createIndex({
        columns: ["taskId"],
        index: "file_asset_taskId_idx_4965c936",
        schema: "public",
        table: "file_asset",
      }),
      this.createIndex({
        columns: ["uploadedById"],
        index: "file_asset_uploadedById_idx_b92fad21",
        schema: "public",
        table: "file_asset",
      }),
      this.createIndex({
        columns: ["actorId"],
        index: "notification_actorId_idx_a58f6b4b",
        schema: "public",
        table: "notification",
      }),
      this.createIndex({
        columns: ["projectId"],
        index: "notification_projectId_idx_a96e4d92",
        schema: "public",
        table: "notification",
      }),
      this.createIndex({
        columns: ["taskId"],
        index: "notification_taskId_idx_4965c936",
        schema: "public",
        table: "notification",
      }),
      this.createIndex({
        columns: ["userId"],
        index: "notification_userId_idx_a489d58a",
        schema: "public",
        table: "notification",
      }),
      this.createIndex({
        columns: ["userId", "readAt", "createdAt"],
        index: "notification_userId_readAt_createdAt_idx_9b6c3810",
        schema: "public",
        table: "notification",
      }),
      this.createIndex({
        columns: ["userId"],
        index: "notification_preference_userId_idx_a489d58a",
        schema: "public",
        table: "notification_preference",
      }),
      this.createIndex({
        columns: ["archivedAt"],
        index: "project_archivedAt_idx_5fc66e5b",
        schema: "public",
        table: "project",
      }),
      this.createIndex({
        columns: ["archivedById"],
        index: "project_archivedById_idx_d546efc6",
        schema: "public",
        table: "project",
      }),
      this.createIndex({
        columns: ["leadId"],
        index: "project_leadId_idx_9113844c",
        schema: "public",
        table: "project",
      }),
      this.createIndex({
        columns: ["status", "position"],
        index: "project_status_position_idx_201c8b80",
        schema: "public",
        table: "project",
      }),
      this.createIndex({
        columns: ["teamId"],
        index: "project_teamId_idx_f2b72ab3",
        schema: "public",
        table: "project",
      }),
      this.createIndex({
        columns: ["projectId"],
        index: "project_member_projectId_idx_a96e4d92",
        schema: "public",
        table: "project_member",
      }),
      this.createIndex({
        columns: ["userId"],
        index: "project_member_userId_idx_a489d58a",
        schema: "public",
        table: "project_member",
      }),
      this.createIndex({
        columns: ["projectId"],
        index: "project_milestone_projectId_idx_a96e4d92",
        schema: "public",
        table: "project_milestone",
      }),
      this.createIndex({
        columns: ["projectId", "position"],
        index: "project_milestone_projectId_position_idx_8e0c4225",
        schema: "public",
        table: "project_milestone",
      }),
      this.createIndex({
        columns: ["userId"],
        index: "recent_search_userId_idx_a489d58a",
        schema: "public",
        table: "recent_search",
      }),
      this.createIndex({
        columns: ["userId", "searchedAt"],
        index: "recent_search_userId_searchedAt_idx_016097ac",
        schema: "public",
        table: "recent_search",
      }),
      this.createIndex({
        columns: ["projectId"],
        index: "saved_view_projectId_idx_a96e4d92",
        schema: "public",
        table: "saved_view",
      }),
      this.createIndex({
        columns: ["userId"],
        index: "saved_view_userId_idx_a489d58a",
        schema: "public",
        table: "saved_view",
      }),
      this.createIndex({
        columns: ["userId", "projectId"],
        index: "saved_view_userId_projectId_idx_a2a73bc7",
        schema: "public",
        table: "saved_view",
      }),
      this.createIndex({
        columns: ["userId"],
        index: "session_userId_idx_a489d58a",
        schema: "public",
        table: "session",
      }),
      this.createIndex({
        columns: ["archivedAt"],
        index: "task_archivedAt_idx_5fc66e5b",
        schema: "public",
        table: "task",
      }),
      this.createIndex({
        columns: ["archivedById"],
        index: "task_archivedById_idx_d546efc6",
        schema: "public",
        table: "task",
      }),
      this.createIndex({
        columns: ["createdById"],
        index: "task_createdById_idx_8bf640ed",
        schema: "public",
        table: "task",
      }),
      this.createIndex({
        columns: ["dueDate"],
        index: "task_dueDate_idx_fb527616",
        schema: "public",
        table: "task",
      }),
      this.createIndex({
        columns: ["projectId"],
        index: "task_projectId_idx_a96e4d92",
        schema: "public",
        table: "task",
      }),
      this.createIndex({
        columns: ["projectId", "status", "position"],
        index: "task_projectId_status_position_idx_e47eb21e",
        schema: "public",
        table: "task",
      }),
      this.createIndex({
        columns: ["assignedById"],
        index: "task_assignee_assignedById_idx_f5db02c3",
        schema: "public",
        table: "task_assignee",
      }),
      this.createIndex({
        columns: ["taskId"],
        index: "task_assignee_taskId_idx_4965c936",
        schema: "public",
        table: "task_assignee",
      }),
      this.createIndex({
        columns: ["userId"],
        index: "task_assignee_userId_idx_a489d58a",
        schema: "public",
        table: "task_assignee",
      }),
      this.createIndex({
        columns: ["userId", "taskId"],
        index: "task_assignee_userId_taskId_idx_1ad162b7",
        schema: "public",
        table: "task_assignee",
      }),
      this.createIndex({
        columns: ["dependsOnTaskId"],
        index: "task_dependency_dependsOnTaskId_idx_213f256d",
        schema: "public",
        table: "task_dependency",
      }),
      this.createIndex({
        columns: ["taskId"],
        index: "task_dependency_taskId_idx_4965c936",
        schema: "public",
        table: "task_dependency",
      }),
      this.createIndex({
        columns: ["labelId"],
        index: "task_label_labelId_idx_e2585939",
        schema: "public",
        table: "task_label",
      }),
      this.createIndex({
        columns: ["taskId"],
        index: "task_label_taskId_idx_4965c936",
        schema: "public",
        table: "task_label",
      }),
      this.createIndex({
        columns: ["taskId"],
        index: "task_subtask_taskId_idx_4965c936",
        schema: "public",
        table: "task_subtask",
      }),
      this.createIndex({
        columns: ["taskId", "position"],
        index: "task_subtask_taskId_position_idx_7b8f9842",
        schema: "public",
        table: "task_subtask",
      }),
      this.createIndex({
        columns: ["teamId"],
        index: "user_teamId_idx_f2b72ab3",
        schema: "public",
        table: "user",
      }),
      this.createIndex({
        columns: ["userId"],
        index: "user_preference_userId_idx_a489d58a",
        schema: "public",
        table: "user_preference",
      }),
      this.createIndex({
        columns: ["identifier"],
        index: "verification_identifier_idx_79a0dbb3",
        schema: "public",
        table: "verification",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["userId"],
          name: "account_userId_fkey",
          onDelete: "cascade",
          references: { columns: ["id"], schema: "public", table: "user" },
        },
        schema: "public",
        table: "account",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["actorId"],
          name: "activity_actorId_fkey",
          onDelete: "restrict",
          references: { columns: ["id"], schema: "public", table: "user" },
        },
        schema: "public",
        table: "activity",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["taskId"],
          name: "activity_taskId_fkey",
          onDelete: "setNull",
          references: { columns: ["id"], schema: "public", table: "task" },
        },
        schema: "public",
        table: "activity",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["projectId"],
          name: "activity_projectId_fkey",
          onDelete: "setNull",
          references: { columns: ["id"], schema: "public", table: "project" },
        },
        schema: "public",
        table: "activity",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["projectId"],
          name: "calendar_event_projectId_fkey",
          onDelete: "setNull",
          references: { columns: ["id"], schema: "public", table: "project" },
        },
        schema: "public",
        table: "calendar_event",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["createdById"],
          name: "calendar_event_createdById_fkey",
          onDelete: "restrict",
          references: { columns: ["id"], schema: "public", table: "user" },
        },
        schema: "public",
        table: "calendar_event",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["eventId"],
          name: "calendar_event_attendee_eventId_fkey",
          onDelete: "cascade",
          references: {
            columns: ["id"],
            schema: "public",
            table: "calendar_event",
          },
        },
        schema: "public",
        table: "calendar_event_attendee",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["userId"],
          name: "calendar_event_attendee_userId_fkey",
          onDelete: "restrict",
          references: { columns: ["id"], schema: "public", table: "user" },
        },
        schema: "public",
        table: "calendar_event_attendee",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["taskId"],
          name: "comment_taskId_fkey",
          onDelete: "cascade",
          references: { columns: ["id"], schema: "public", table: "task" },
        },
        schema: "public",
        table: "comment",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["authorId"],
          name: "comment_authorId_fkey",
          onDelete: "restrict",
          references: { columns: ["id"], schema: "public", table: "user" },
        },
        schema: "public",
        table: "comment",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["deletedById"],
          name: "comment_deletedById_fkey",
          onDelete: "restrict",
          references: { columns: ["id"], schema: "public", table: "user" },
        },
        schema: "public",
        table: "comment",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["commentId"],
          name: "comment_reaction_commentId_fkey",
          onDelete: "cascade",
          references: { columns: ["id"], schema: "public", table: "comment" },
        },
        schema: "public",
        table: "comment_reaction",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["userId"],
          name: "comment_reaction_userId_fkey",
          onDelete: "restrict",
          references: { columns: ["id"], schema: "public", table: "user" },
        },
        schema: "public",
        table: "comment_reaction",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["userId"],
          name: "favorite_project_userId_fkey",
          onDelete: "cascade",
          references: { columns: ["id"], schema: "public", table: "user" },
        },
        schema: "public",
        table: "favorite_project",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["projectId"],
          name: "favorite_project_projectId_fkey",
          onDelete: "cascade",
          references: { columns: ["id"], schema: "public", table: "project" },
        },
        schema: "public",
        table: "favorite_project",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["userId"],
          name: "favorite_task_userId_fkey",
          onDelete: "cascade",
          references: { columns: ["id"], schema: "public", table: "user" },
        },
        schema: "public",
        table: "favorite_task",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["taskId"],
          name: "favorite_task_taskId_fkey",
          onDelete: "cascade",
          references: { columns: ["id"], schema: "public", table: "task" },
        },
        schema: "public",
        table: "favorite_task",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["projectId"],
          name: "file_asset_projectId_fkey",
          onDelete: "restrict",
          references: { columns: ["id"], schema: "public", table: "project" },
        },
        schema: "public",
        table: "file_asset",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["taskId"],
          name: "file_asset_taskId_fkey",
          onDelete: "setNull",
          references: { columns: ["id"], schema: "public", table: "task" },
        },
        schema: "public",
        table: "file_asset",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["uploadedById"],
          name: "file_asset_uploadedById_fkey",
          onDelete: "restrict",
          references: { columns: ["id"], schema: "public", table: "user" },
        },
        schema: "public",
        table: "file_asset",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["deletedById"],
          name: "file_asset_deletedById_fkey",
          onDelete: "restrict",
          references: { columns: ["id"], schema: "public", table: "user" },
        },
        schema: "public",
        table: "file_asset",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["userId"],
          name: "notification_userId_fkey",
          onDelete: "restrict",
          references: { columns: ["id"], schema: "public", table: "user" },
        },
        schema: "public",
        table: "notification",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["actorId"],
          name: "notification_actorId_fkey",
          onDelete: "setNull",
          references: { columns: ["id"], schema: "public", table: "user" },
        },
        schema: "public",
        table: "notification",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["taskId"],
          name: "notification_taskId_fkey",
          onDelete: "setNull",
          references: { columns: ["id"], schema: "public", table: "task" },
        },
        schema: "public",
        table: "notification",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["projectId"],
          name: "notification_projectId_fkey",
          onDelete: "setNull",
          references: { columns: ["id"], schema: "public", table: "project" },
        },
        schema: "public",
        table: "notification",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["userId"],
          name: "notification_preference_userId_fkey",
          onDelete: "cascade",
          references: { columns: ["id"], schema: "public", table: "user" },
        },
        schema: "public",
        table: "notification_preference",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["teamId"],
          name: "project_teamId_fkey",
          onDelete: "setNull",
          references: { columns: ["id"], schema: "public", table: "team" },
        },
        schema: "public",
        table: "project",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["leadId"],
          name: "project_leadId_fkey",
          onDelete: "restrict",
          references: { columns: ["id"], schema: "public", table: "user" },
        },
        schema: "public",
        table: "project",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["archivedById"],
          name: "project_archivedById_fkey",
          onDelete: "restrict",
          references: { columns: ["id"], schema: "public", table: "user" },
        },
        schema: "public",
        table: "project",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["projectId"],
          name: "project_member_projectId_fkey",
          onDelete: "cascade",
          references: { columns: ["id"], schema: "public", table: "project" },
        },
        schema: "public",
        table: "project_member",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["userId"],
          name: "project_member_userId_fkey",
          onDelete: "restrict",
          references: { columns: ["id"], schema: "public", table: "user" },
        },
        schema: "public",
        table: "project_member",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["projectId"],
          name: "project_milestone_projectId_fkey",
          onDelete: "cascade",
          references: { columns: ["id"], schema: "public", table: "project" },
        },
        schema: "public",
        table: "project_milestone",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["userId"],
          name: "recent_search_userId_fkey",
          onDelete: "cascade",
          references: { columns: ["id"], schema: "public", table: "user" },
        },
        schema: "public",
        table: "recent_search",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["userId"],
          name: "saved_view_userId_fkey",
          onDelete: "cascade",
          references: { columns: ["id"], schema: "public", table: "user" },
        },
        schema: "public",
        table: "saved_view",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["projectId"],
          name: "saved_view_projectId_fkey",
          onDelete: "setNull",
          references: { columns: ["id"], schema: "public", table: "project" },
        },
        schema: "public",
        table: "saved_view",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["userId"],
          name: "session_userId_fkey",
          onDelete: "cascade",
          references: { columns: ["id"], schema: "public", table: "user" },
        },
        schema: "public",
        table: "session",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["projectId"],
          name: "task_projectId_fkey",
          onDelete: "restrict",
          references: { columns: ["id"], schema: "public", table: "project" },
        },
        schema: "public",
        table: "task",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["createdById"],
          name: "task_createdById_fkey",
          onDelete: "restrict",
          references: { columns: ["id"], schema: "public", table: "user" },
        },
        schema: "public",
        table: "task",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["archivedById"],
          name: "task_archivedById_fkey",
          onDelete: "restrict",
          references: { columns: ["id"], schema: "public", table: "user" },
        },
        schema: "public",
        table: "task",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["taskId"],
          name: "task_assignee_taskId_fkey",
          onDelete: "cascade",
          references: { columns: ["id"], schema: "public", table: "task" },
        },
        schema: "public",
        table: "task_assignee",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["userId"],
          name: "task_assignee_userId_fkey",
          onDelete: "restrict",
          references: { columns: ["id"], schema: "public", table: "user" },
        },
        schema: "public",
        table: "task_assignee",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["assignedById"],
          name: "task_assignee_assignedById_fkey",
          onDelete: "restrict",
          references: { columns: ["id"], schema: "public", table: "user" },
        },
        schema: "public",
        table: "task_assignee",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["taskId"],
          name: "task_dependency_taskId_fkey",
          onDelete: "cascade",
          references: { columns: ["id"], schema: "public", table: "task" },
        },
        schema: "public",
        table: "task_dependency",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["dependsOnTaskId"],
          name: "task_dependency_dependsOnTaskId_fkey",
          onDelete: "cascade",
          references: { columns: ["id"], schema: "public", table: "task" },
        },
        schema: "public",
        table: "task_dependency",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["taskId"],
          name: "task_label_taskId_fkey",
          onDelete: "cascade",
          references: { columns: ["id"], schema: "public", table: "task" },
        },
        schema: "public",
        table: "task_label",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["labelId"],
          name: "task_label_labelId_fkey",
          onDelete: "restrict",
          references: { columns: ["id"], schema: "public", table: "label" },
        },
        schema: "public",
        table: "task_label",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["taskId"],
          name: "task_recurrence_taskId_fkey",
          onDelete: "cascade",
          references: { columns: ["id"], schema: "public", table: "task" },
        },
        schema: "public",
        table: "task_recurrence",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["taskId"],
          name: "task_subtask_taskId_fkey",
          onDelete: "cascade",
          references: { columns: ["id"], schema: "public", table: "task" },
        },
        schema: "public",
        table: "task_subtask",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["teamId"],
          name: "user_teamId_fkey",
          onDelete: "setNull",
          references: { columns: ["id"], schema: "public", table: "team" },
        },
        schema: "public",
        table: "user",
      }),
      this.addForeignKey({
        foreignKey: {
          columns: ["userId"],
          name: "user_preference_userId_fkey",
          onDelete: "cascade",
          references: { columns: ["id"], schema: "public", table: "user" },
        },
        schema: "public",
        table: "user_preference",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
