/* eslint-disable shadcn/no-unknown-classes -- Bug screens use reference workspace styles from app/workspace-styles. */

import type { Metadata } from "next";
import { Suspense } from "react";

import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import {
  BugApprovalList,
  BugApprovalListSkeleton,
} from "@/features/bugs/components/bug-approval-list";

export const metadata: Metadata = { title: "Bug approvals | Metsys" };

const BugApprovalPage = () => (
  <div className="page flush">
    <section aria-labelledby="bug-approvals-heading" className="page bug-page">
      <header className="bug-page-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 id="bug-approvals-heading">Bug approvals</h1>
          <p className="muted">
            Review verified fixes and their before and after evidence.
          </p>
        </div>
      </header>
      <SectionErrorBoundary title="bug approvals could not be loaded">
        <Suspense fallback={<BugApprovalListSkeleton />}>
          <BugApprovalList />
        </Suspense>
      </SectionErrorBoundary>
    </section>
  </div>
);

export default BugApprovalPage;
