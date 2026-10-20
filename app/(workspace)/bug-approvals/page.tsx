/* eslint-disable shadcn/no-unknown-classes -- Bug screens use reference workspace styles from app/workspace-styles. */

import type { Metadata } from "next";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
import { BugApprovalList } from "@/features/bugs/components/bug-approval-list";

export const metadata: Metadata = { title: "Bug approvals | Metsys" };

const BugApprovalPage = () => (
  <PageTransition>
    <div className="page flush">
      <section
        aria-labelledby="bug-approvals-heading"
        className="page bug-page"
      >
        <header className="bug-page-header">
          <div>
            <p className="eyebrow">Admin</p>
            <h1 id="bug-approvals-heading">Bug approvals</h1>
            <p className="muted">
              Review verified fixes and their before and after evidence.
            </p>
          </div>
        </header>
        <SectionErrorBoundary title="Bug approvals couldn't load">
          <SuspenseReveal
            fallback={
              <PanelSkeleton
                label="Loading approvals…"
                rows={4}
                variant="bugs"
              />
            }
          >
            <BugApprovalList />
          </SuspenseReveal>
        </SectionErrorBoundary>
      </section>
    </div>
  </PageTransition>
);

export default BugApprovalPage;
