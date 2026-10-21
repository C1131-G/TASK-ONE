// Optimistic read state for the inbox: what the list shows between a click on
// "Mark as read" and the server's refreshed notifications.

interface ReadableNotification {
  readonly id: string;
  readonly readAt: string | null;
}

interface MarkRead {
  // A notification ID, or "all" for "Mark all as read".
  readonly id: string;
  readonly readAt: string;
}

const withNotificationsRead = <Item extends ReadableNotification>(
  items: readonly Item[],
  { id, readAt }: MarkRead
): Item[] =>
  items.map((item) =>
    item.readAt === null && (id === "all" || item.id === id)
      ? { ...item, readAt }
      : item
  );

const unreadIn = (items: readonly ReadableNotification[]): number =>
  items.filter(({ readAt }) => readAt === null).length;

// The server's unread total minus the loaded notifications read here since.
const shownUnreadCount = (
  serverUnreadCount: number,
  serverItems: readonly ReadableNotification[],
  shownItems: readonly ReadableNotification[]
): number =>
  Math.max(
    0,
    serverUnreadCount - (unreadIn(serverItems) - unreadIn(shownItems))
  );

export { shownUnreadCount, withNotificationsRead };
