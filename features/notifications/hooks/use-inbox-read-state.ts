"use client";

import { useOptimistic, useState, useTransition } from "react";

import {
  shownUnreadCount,
  withNotificationsRead,
} from "@/features/notifications/inbox-read-state";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/features/notifications/notifications-actions";
import type { NotificationItem } from "@/src/server/notifications/contracts";

// Marking read shows at once. The action's refresh brings the saved state;
// when it fails the optimistic read falls away and the error is shown.
const useInboxReadState = (
  items: readonly NotificationItem[],
  unreadCount: number
) => {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [shownItems, markShownRead] = useOptimistic(
    items,
    withNotificationsRead<NotificationItem>
  );

  const markRead = (notificationId: string) =>
    startTransition(async () => {
      markShownRead({ id: notificationId, readAt: new Date().toISOString() });
      const result = await markNotificationReadAction({
        idempotencyKey: crypto.randomUUID(),
        notificationId,
      });
      setError(result.ok ? null : result.error.message);
    });

  const markAllRead = () =>
    startTransition(async () => {
      markShownRead({ id: "all", readAt: new Date().toISOString() });
      const result = await markAllNotificationsReadAction({
        idempotencyKey: crypto.randomUUID(),
      });
      setError(result.ok ? null : result.error.message);
    });

  return {
    error,
    markAllRead,
    markRead,
    pending,
    shownItems,
    shownUnread: shownUnreadCount(unreadCount, items, shownItems),
  };
};

export { useInboxReadState };
