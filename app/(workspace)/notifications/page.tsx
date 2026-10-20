/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import {
  NotificationFeed,
  NotificationFeedSkeleton,
} from "@/features/notifications/components/notification-feed";

export const metadata: Metadata = { title: "Notifications | Metsys" };

const NotificationsPage = () => (
  <PageTransition>
    <div className="page">
      <SectionErrorBoundary title="Notifications couldn't load">
        <SuspenseReveal fallback={<NotificationFeedSkeleton />}>
          <NotificationFeed />
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default NotificationsPage;
