import type { Effect } from "effect";

import type { AppFailure } from "@/errors";
import type { MobileApi } from "@/services/mobile-api";

export type NotificationKind = "assignment" | "comment" | "mention" | "update";

export interface InboxItem {
  readonly createdAt: string;
  readonly id: string;
  readonly kind: NotificationKind;
  readonly readAt: string | null;
  readonly taskId: string | null;
  readonly taskTitle: string | null;
  readonly title: string;
}

export interface InboxPage {
  readonly items: readonly InboxItem[];
  readonly unread: number;
}

type Api = MobileApi["Service"];

interface TypedClient {
  readonly listInbox: (input: {
    readonly query?: { readonly unreadOnly?: string };
  }) => Promise<InboxPage>;
  readonly markAllInboxRead: (input: { readonly idempotencyKey: string }) => Promise<{ readonly unread: number }>;
  readonly markInboxItemRead: (input: {
    readonly idempotencyKey: string;
    readonly params: { readonly id: string };
  }) => Promise<{ readonly id: string; readonly readAt: string }>;
}

export const listInbox = (
  api: Api,
  unreadOnly = false,
): Effect.Effect<InboxPage, AppFailure> =>
  api.call((client) =>
    (client as unknown as TypedClient).listInbox((unreadOnly ? { query: { unreadOnly: "true" } } : {})),
  );

export const markInboxItemRead = (
  api: Api,
  key: string,
  id: string,
): Effect.Effect<{ readonly id: string; readonly readAt: string }, AppFailure> =>
  api.call((client) =>
    (client as unknown as TypedClient).markInboxItemRead({
      idempotencyKey: key,
      params: { id },
    }),
  );

export const markAllInboxRead = (
  api: Api,
  key: string,
): Effect.Effect<{ readonly unread: number }, AppFailure> =>
  api.call((client) =>
    (client as unknown as TypedClient).markAllInboxRead({ idempotencyKey: key }),
  );

/** Groups inbox items into All and Unread tabs (pure; pinned by tests). */
export const splitInbox = (
  items: readonly InboxItem[],
): { readonly all: readonly InboxItem[]; readonly unread: readonly InboxItem[] } => ({
  all: items,
  unread: items.filter((item) => item.readAt === null),
});
