/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { connection } from "next/server";

import { listNotificationInboxAction } from "@/app/actions/notifications";
import { InboxWorkspace } from "@/components/workspace/inbox-workspace";

export const metadata: Metadata = { title: "Inbox | Metsys" };

const InboxPage = async () => {
  await connection();
  const result = await listNotificationInboxAction({
    limit: 100,
    unreadOnly: false,
  });
  if (!result.ok) {
    return (
      <div className="page">
        <div className="panel panel-b" role="alert">
          Inbox could not be loaded. Refresh to retry.
        </div>
      </div>
    );
  }
  return (
    <div className="page">
      <div className="ph">
        <div>
          <h1>Inbox</h1>
        </div>
      </div>
      <InboxWorkspace
        items={result.data.items}
        unreadCount={result.data.unreadCount}
      />
    </div>
  );
};

export default InboxPage;
