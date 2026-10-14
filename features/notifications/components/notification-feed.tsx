/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in app/workspace-styles. */

import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
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

// The title carries the unread count, so the skeleton keeps only the static
// title and subtitle.
const NotificationFeedSkeleton = () => (
  <section aria-label="Workspace notifications" className="notification-page">
    <header className="notification-page-heading">
      <div>
        <h1>Notifications</h1>
        <p>Updates on tasks and projects you follow.</p>
      </div>
    </header>
    <PanelSkeleton label="Loading notifications…" rows={6} />
  </section>
);

export { NotificationFeed, NotificationFeedSkeleton };
