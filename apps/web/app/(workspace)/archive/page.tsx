/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import {
  ArchivedWorkSkeleton,
  ArchivedWork,
} from "@/features/archive/components/archived-work";

export const metadata: Metadata = { title: "Archive | Taskora" };

const ArchivePage = () => (
  <PageTransition>
    <div className="page">
      <div className="ph">
        <div>
          <h1>Archive</h1>
          <p>
            Archived work is hidden from active views. Restore it when it is
            needed.
          </p>
        </div>
      </div>
      <SectionErrorBoundary title="Archive couldn't load">
        <SuspenseReveal fallback={<ArchivedWorkSkeleton />}>
          <ArchivedWork />
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default ArchivePage;
