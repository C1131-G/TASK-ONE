/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in app/workspace-styles. */

import { InboxWorkspace } from "@/features/notifications/components/inbox-workspace";
import { listNotificationInbox } from "@/features/notifications/notifications-queries";

const InboxFeed = async () => {
  const result = await listNotificationInbox({ limit: 100, unreadOnly: false });
  if (!result.ok) {
    throw new Error("Inbox could not be loaded.");
  }
  return (
    <InboxWorkspace
      items={result.data.items}
      unreadCount={result.data.unreadCount}
    />
  );
};

export { InboxFeed };
