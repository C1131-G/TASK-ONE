/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in app/workspace-styles. */

import { NotificationList } from "@/features/notifications/components/notification-list";
import { listNotificationInbox } from "@/features/notifications/notifications-queries";

const NotificationFeed = async () => {
  const result = await listNotificationInbox({ limit: 100, unreadOnly: false });
  if (!result.ok) {
    return (
      <div className="panel panel-b" role="alert">
        Notifications could not be loaded. Refresh to retry.
      </div>
    );
  }
  return (
    <NotificationList
      items={result.data.items}
      unreadCount={result.data.unreadCount}
    />
  );
};

export { NotificationFeed };
