/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
import {
  WorkspaceOverviewActions,
  WorkspaceOverviewActionsSkeleton,
  WorkspaceOverview,
} from "@/features/dashboard/components/workspace-overview";

export const metadata: Metadata = { title: "Overview | Metsys" };

const OverviewPage = () => (
  <PageTransition>
    <div className="page">
      <div className="ph">
        <div>
          <h1>Workspace overview</h1>
          <p>Health of every project in Metsys.</p>
        </div>
        <SectionErrorBoundary title="Overview actions couldn't load">
          <SuspenseReveal fallback={<WorkspaceOverviewActionsSkeleton />}>
            <WorkspaceOverviewActions />
          </SuspenseReveal>
        </SectionErrorBoundary>
      </div>
      <SectionErrorBoundary title="Workspace overview couldn't load">
        <SuspenseReveal
          fallback={
            <PanelSkeleton
              label="Loading workspace overview…"
              variant="overview"
            />
          }
        >
          <WorkspaceOverview />
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default OverviewPage;
