/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in app/workspace-styles. */

import { connection } from "next/server";

import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
import { NotificationList } from "@/features/notifications/components/notification-list";
import { listNotificationInbox } from "@/features/notifications/notifications-queries";

const NotificationFeed = async () => {
  await connection();
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

const NotificationFeedSkeleton = () => (
  <PanelSkeleton label="Loading notifications…" rows={6} />
);

export { NotificationFeed, NotificationFeedSkeleton };
