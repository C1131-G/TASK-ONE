/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { Suspense } from "react";

import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import {
  ActivityFeed,
  ActivityFeedSkeleton,
} from "@/features/activity/components/activity-feed";

export const metadata: Metadata = { title: "Activity | Metsys" };

const ActivityPage = () => (
  <div className="page">
    <div className="ph">
      <div>
        <h1>Activity</h1>
        <p>Everything that&apos;s changed across the workspace.</p>
      </div>
    </div>
    <SectionErrorBoundary title="activity could not be loaded">
      <Suspense fallback={<ActivityFeedSkeleton />}>
        <ActivityFeed />
      </Suspense>
    </SectionErrorBoundary>
  </div>
);

export default ActivityPage;
