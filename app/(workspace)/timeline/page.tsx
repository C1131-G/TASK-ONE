/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { Suspense } from "react";

import {
  ProjectTimeline,
  ProjectTimelineSkeleton,
} from "@/features/projects/components/project-timeline";
import { parseTaskIdParam } from "@/features/tasks/task-param";

export const metadata: Metadata = { title: "Timeline | Metsys" };

const TimelinePage = ({ searchParams }: PageProps<"/timeline">) => (
  <div className="page">
    <div className="ph">
      <div>
        <h1>Timeline</h1>
        <p>Search, filter, and schedule work across active projects.</p>
      </div>
    </div>
    <Suspense fallback={<ProjectTimelineSkeleton />}>
      {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
      {searchParams.then((params) => (
        <ProjectTimeline initialTaskId={parseTaskIdParam(params["task"])} />
      ))}
    </Suspense>
  </div>
);

export default TimelinePage;
