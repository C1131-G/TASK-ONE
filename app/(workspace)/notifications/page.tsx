/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { Suspense } from "react";

import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import {
  NotificationFeed,
  NotificationFeedSkeleton,
} from "@/features/notifications/components/notification-feed";

export const metadata: Metadata = { title: "Notifications | Metsys" };

const NotificationsPage = () => (
  <div className="page">
    <SectionErrorBoundary title="notifications could not be loaded">
      <Suspense fallback={<NotificationFeedSkeleton />}>
        <NotificationFeed />
      </Suspense>
    </SectionErrorBoundary>
  </div>
);

export default NotificationsPage;
