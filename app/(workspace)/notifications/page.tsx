/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { Suspense } from "react";

import {
  NotificationFeed,
  NotificationFeedSkeleton,
} from "@/features/notifications/components/notification-feed";

export const metadata: Metadata = { title: "Notifications | Metsys" };
export const instant = false;

const NotificationsPage = () => (
  <div className="page">
    <Suspense fallback={<NotificationFeedSkeleton />}>
      <NotificationFeed />
    </Suspense>
  </div>
);

export default NotificationsPage;
