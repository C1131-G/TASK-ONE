/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in app/workspace-styles. */

import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
import { InboxWorkspace } from "@/features/notifications/components/inbox-workspace";
import { listNotificationInbox } from "@/features/notifications/notifications-queries";

const InboxFeed = async () => {
  const result = await listNotificationInbox({ limit: 100, unreadOnly: false });
  if (!result.ok) {
    return (
      <div className="panel panel-b" role="alert">
        Inbox could not be loaded. Refresh to retry.
      </div>
    );
  }
  return (
    <InboxWorkspace
      items={result.data.items}
      unreadCount={result.data.unreadCount}
    />
  );
};

const InboxFeedSkeleton = () => (
  <PanelSkeleton variant="inbox" label="Loading inbox…" rows={6} />
);

export { InboxFeed, InboxFeedSkeleton };
