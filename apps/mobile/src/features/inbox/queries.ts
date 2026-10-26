import type { Effect } from "effect";

import type { WorkspaceInboxSchema, WorkspaceNotificationSchema } from "@api/routes-notifications";
import type { AppFailure } from "@/errors";
import type { MobileApi } from "@/services/mobile-api";

export type InboxItem = typeof WorkspaceNotificationSchema.Type;
export type InboxPage = typeof WorkspaceInboxSchema.Type;

type Api = MobileApi["Service"];

/** One page of the caller's notifications, newest first, with the unread counts. */
export const listInbox = (api: Api, unreadOnly = false): Effect.Effect<InboxPage, AppFailure> =>
  api.call((client) =>
    client.listWorkspaceNotifications({ query: unreadOnly ? { unreadOnly: "true" } : {} }),
  );

export const markInboxItemRead = (
  api: Api,
  key: string,
  id: string,
): Effect.Effect<{ readonly done: true }, AppFailure> =>
  api.call((client) =>
    client.markWorkspaceNotificationRead({ idempotencyKey: key, params: { id } }),
  );

export const markAllInboxRead = (
  api: Api,
  key: string,
): Effect.Effect<{ readonly count: number }, AppFailure> =>
  api.call((client) => client.markAllWorkspaceNotificationsRead({ idempotencyKey: key }));

/** Groups inbox items into All and Unread tabs (pure; pinned by tests). */
export const splitInbox = (
  items: readonly InboxItem[],
): { readonly all: readonly InboxItem[]; readonly unread: readonly InboxItem[] } => ({
  all: items,
  unread: items.filter((entry) => entry.readAt === null),
});
