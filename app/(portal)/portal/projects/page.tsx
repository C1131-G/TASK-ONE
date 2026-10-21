/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import type { Metadata } from "next";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import {
  PortalProjectList,
  PortalProjectListSkeleton,
} from "@/features/portal/components/portal-project-list";

export const metadata: Metadata = {
  description: "Projects the team shares with your company.",
  title: "Projects | Metsys",
};

const Page = () => (
  <PageTransition>
    <div className="page">
      <div className="ph">
        <div>
          <h1>Projects</h1>
          <p>Progress and upcoming milestones for projects shared with you.</p>
        </div>
      </div>
      <SectionErrorBoundary title="Projects couldn't load">
        <SuspenseReveal fallback={<PortalProjectListSkeleton />}>
          <PortalProjectList />
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default Page;
