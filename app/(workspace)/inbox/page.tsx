/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { Suspense } from "react";

import {
  InboxFeed,
  InboxFeedSkeleton,
} from "@/features/notifications/components/inbox-feed";

export const metadata: Metadata = { title: "Inbox | Metsys" };

const InboxPage = () => (
  <div className="page">
    <div className="ph">
      <div>
        <h1>Inbox</h1>
      </div>
    </div>
    <Suspense fallback={<InboxFeedSkeleton />}>
      <InboxFeed />
    </Suspense>
  </div>
);

export default InboxPage;
