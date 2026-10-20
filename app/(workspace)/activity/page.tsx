/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import {
  ActivityFeed,
  ActivityFeedSkeleton,
} from "@/features/activity/components/activity-feed";

export const metadata: Metadata = { title: "Activity | Metsys" };

const ActivityPage = () => (
  <PageTransition>
    <div className="page">
      <div className="ph">
        <div>
          <h1>Activity</h1>
          <p>Everything that&apos;s changed across the workspace.</p>
        </div>
      </div>
      <SectionErrorBoundary title="Activity couldn't load">
        <SuspenseReveal fallback={<ActivityFeedSkeleton />}>
          <ActivityFeed />
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default ActivityPage;
