/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import {
  ProjectTimeline,
  ProjectTimelineSkeleton,
} from "@/features/projects/components/project-timeline";
import { parseTaskIdParam } from "@/features/tasks/task-param";

export const metadata: Metadata = { title: "Timeline | Taskora" };

const TimelinePage = ({ searchParams }: PageProps<"/timeline">) => (
  <PageTransition>
    <div className="page">
      <div className="ph">
        <div>
          <h1>Timeline</h1>
          <p>Search, filter, and schedule work across active projects.</p>
        </div>
      </div>
      <SectionErrorBoundary title="Timeline couldn't load">
        <SuspenseReveal fallback={<ProjectTimelineSkeleton />}>
          {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
          {searchParams.then((params) => (
            <ProjectTimeline initialTaskId={parseTaskIdParam(params["task"])} />
          ))}
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default TimelinePage;
