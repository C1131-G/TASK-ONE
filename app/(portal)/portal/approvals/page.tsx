/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import type { Metadata } from "next";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import {
  PortalApprovalList,
  PortalApprovalListSkeleton,
} from "@/features/portal/components/portal-approval-list";

export const metadata: Metadata = {
  description: "Deliverables the team asks your company to review.",
  title: "Approvals | Metsys",
};

const Page = () => (
  <PageTransition>
    <div className="page">
      <div className="ph">
        <div>
          <h1>Approvals</h1>
          <p>
            Review the files the team sends you and approve or ask for changes.
          </p>
        </div>
      </div>
      <SectionErrorBoundary title="Approvals couldn't load">
        <SuspenseReveal fallback={<PortalApprovalListSkeleton />}>
          <PortalApprovalList />
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default Page;
