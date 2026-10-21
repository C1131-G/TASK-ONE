/* eslint-disable shadcn/no-unknown-classes */

import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import {
  ProjectTimeReport,
  ProjectTimeReportSkeleton,
} from "@/features/time/components/project-time-report";
import { projectReportRange } from "@/features/time/time-params";
import { getUtcToday } from "@/src/lib/utc-today";

export const metadata: Metadata = { title: "Project time | Metsys" };

const ProjectTimePage = ({
  params,
  searchParams,
}: PageProps<"/projects/[projectId]/time">) => {
  // oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell.
  const route = Promise.all([params, searchParams]).then(
    ([{ projectId }, query]) => ({
      projectId,
      range: projectReportRange(query["from"], query["to"], getUtcToday()),
    })
  );
  return (
    <PageTransition>
      <div className="page">
        <Link
          className="member-profile-back"
          href="/projects"
          transitionTypes={["nav-back"]}
        >
          <ArrowLeft aria-hidden="true" size={15} />
          All projects
        </Link>
        <div className="ph">
          <div>
            <h1>Project time</h1>
            <p>Logged hours by person and task, billable and not.</p>
          </div>
        </div>
        <SectionErrorBoundary title="The time report couldn't load">
          <SuspenseReveal fallback={<ProjectTimeReportSkeleton />}>
            {/* oxlint-disable-next-line promise/prefer-await-to-then -- Route values resolve inside the boundary. */}
            {route.then(({ projectId, range }) => (
              <ProjectTimeReport
                from={range.from}
                projectId={projectId}
                to={range.to}
              />
            ))}
          </SuspenseReveal>
        </SectionErrorBoundary>
      </div>
    </PageTransition>
  );
};

export default ProjectTimePage;
