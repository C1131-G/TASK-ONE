import type { Effect } from "effect";
import { Context, Schema } from "effect";

import type { AppError } from "../core/action-result";

export interface NotificationItem {
  readonly id: string;
  readonly type: string;
  readonly text: string;
  readonly snippet: string | null;
  readonly taskId: string | null;
  readonly projectId: string | null;
  readonly projectName: string | null;
  readonly actorId: string | null;
  readonly actorName: string | null;
  readonly readAt: string | null;
  readonly createdAt: string;
}

export interface InboxPage {
  readonly items: readonly NotificationItem[];
  readonly unreadCount: number;
  readonly unreadInboxCount: number;
}

export interface InboxOptions {
  readonly unreadOnly: boolean;
  readonly limit: number;
}

export type NotificationChannel = "in-app" | "web-push" | "email";
export type NotificationPreferenceEvent =
  | "mention"
  | "assignment"
  | "comment"
  | "update"
  | "due"
  | "status";

export interface NotificationPreferenceValue {
  readonly channel: NotificationChannel;
  readonly enabled: boolean;
  readonly eventType: NotificationPreferenceEvent;
}

export const InboxSchema = Schema.Struct({
  items: Schema.Array(
    Schema.Struct({
      actorId: Schema.NullOr(Schema.String),
      actorName: Schema.NullOr(Schema.String),
      createdAt: Schema.String,
      id: Schema.String,
      projectId: Schema.NullOr(Schema.String),
      projectName: Schema.NullOr(Schema.String),
      readAt: Schema.NullOr(Schema.String),
      snippet: Schema.NullOr(Schema.String),
      taskId: Schema.NullOr(Schema.String),
      text: Schema.String,
      type: Schema.String,
    })
  ),
  unreadCount: Schema.Number,
  unreadInboxCount: Schema.Number,
});

export const NotificationPreferencesSchema = Schema.Array(
  Schema.Struct({
    channel: Schema.Literals(["in-app", "web-push", "email"]),
    enabled: Schema.Boolean,
    eventType: Schema.Literals([
      "mention",
      "assignment",
      "comment",
      "update",
      "due",
      "status",
    ]),
  })
);

export class Notifications extends Context.Service<
  Notifications,
  {
    readonly listInbox: (
      userId: string,
      options: InboxOptions
    ) => Effect.Effect<InboxPage, AppError>;
    readonly listPreferences: (
      userId: string
    ) => Effect.Effect<readonly NotificationPreferenceValue[], AppError>;
    readonly markRead: (
      userId: string,
      notificationId: string
    ) => Effect.Effect<void, AppError>;
    readonly markAllRead: (userId: string) => Effect.Effect<number, AppError>;
    readonly setPreference: (
      userId: string,
      channel: NotificationChannel,
      eventType: NotificationPreferenceEvent,
      enabled: boolean
    ) => Effect.Effect<void, AppError>;
    readonly sendDailyDueSummaries: (
      scheduledAt: Date
    ) => Effect.Effect<{ readonly usersNotified: number }, AppError>;
  }
>()("metsys/server/Notifications") {}
