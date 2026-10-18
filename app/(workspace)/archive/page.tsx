/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { Suspense } from "react";

import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import {
  ArchivedWorkSkeleton,
  ArchivedWork,
} from "@/features/archive/components/archived-work";

export const metadata: Metadata = { title: "Archive | Metsys" };

const ArchivePage = () => (
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
    <SectionErrorBoundary title="archive could not be loaded">
      <Suspense fallback={<ArchivedWorkSkeleton />}>
        <ArchivedWork />
      </Suspense>
    </SectionErrorBoundary>
  </div>
);

export default ArchivePage;
