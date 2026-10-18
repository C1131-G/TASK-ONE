/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { Suspense } from "react";

import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import {
  WorkspaceOverviewActions,
  WorkspaceOverviewActionsSkeleton,
  WorkspaceOverview,
  WorkspaceOverviewSkeleton,
} from "@/features/dashboard/components/workspace-overview";

export const metadata: Metadata = { title: "Overview | Metsys" };

const OverviewPage = () => (
  <div className="page">
    <div className="ph">
      <div>
        <h1>Workspace overview</h1>
        <p>Health of every project in Metsys.</p>
      </div>
      <SectionErrorBoundary title="Overview actions could not be loaded">
        <Suspense fallback={<WorkspaceOverviewActionsSkeleton />}>
          <WorkspaceOverviewActions />
        </Suspense>
      </SectionErrorBoundary>
    </div>
    <SectionErrorBoundary title="Workspace overview could not be loaded">
      <Suspense fallback={<WorkspaceOverviewSkeleton />}>
        <WorkspaceOverview />
      </Suspense>
    </SectionErrorBoundary>
  </div>
);

export default OverviewPage;
