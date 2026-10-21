/* eslint-disable shadcn/no-unknown-classes -- Bug screens use reference workspace styles from app/workspace-styles. */

import type { Metadata } from "next";
import { Suspense } from "react";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import { parseBugFilters } from "@/features/bugs/bug-filters";
import {
  BugReportAction,
  BugReportActionSkeleton,
  BugTracker,
  BugTrackerSkeleton,
} from "@/features/bugs/components/bug-tracker";

export const metadata: Metadata = { title: "Bugs | Metsys" };

const BugsPage = ({ searchParams }: PageProps<"/bugs">) => (
  <PageTransition>
    <div className="page flush">
      <section aria-labelledby="bugs-heading" className="page bug-page">
        <header className="bug-page-header">
          <div>
            <p className="eyebrow">Workspace</p>
            <h1 id="bugs-heading">Bugs</h1>
            <p className="muted">
              Track issues, compare earlier fixes, and follow each release.
            </p>
          </div>
          <SectionErrorBoundary title="Bug reporting is unavailable">
            <Suspense fallback={<BugReportActionSkeleton />}>
              <BugReportAction />
            </Suspense>
          </SectionErrorBoundary>
        </header>
        <SectionErrorBoundary title="Bugs couldn't load">
          <SuspenseReveal fallback={<BugTrackerSkeleton />}>
            {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
            {searchParams.then((params) => (
              <BugTracker filters={parseBugFilters(params)} />
            ))}
          </SuspenseReveal>
        </SectionErrorBoundary>
      </section>
    </div>
  </PageTransition>
);

export default BugsPage;
