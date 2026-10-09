/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { Suspense } from "react";

import {
  ActivityFeed,
  ActivityFeedSkeleton,
} from "@/components/workspace/activity-feed";

export const metadata: Metadata = { title: "Activity | Metsys" };

const ActivityPage = () => (
  <div className="page">
    <div className="ph">
      <div>
        <h1>Activity</h1>
        <p>Recent changes across your projects.</p>
      </div>
    </div>
    <Suspense fallback={<ActivityFeedSkeleton />}>
      <ActivityFeed />
    </Suspense>
  </div>
);

export default ActivityPage;
