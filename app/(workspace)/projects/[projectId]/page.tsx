/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import {
  ProjectBody,
  ProjectBodySkeleton,
  ProjectHeader,
  ProjectHeaderSkeleton,
} from "@/features/projects/components/project-detail";
import { parseProjectDetailQuery } from "@/features/projects/project-detail-params";
import { projectMetadata } from "@/features/projects/project-metadata";
import { parseTaskIdParam } from "@/features/tasks/task-param";

const DynamicMetadataMarker = async () => {
  await connection();
  return null;
};

export const generateMetadata = async ({
  params,
}: PageProps<"/projects/[projectId]">): Promise<Metadata> => {
  const { projectId } = await params;
  return await projectMetadata(projectId);
};

const ProjectPage = ({
  params,
  searchParams,
}: PageProps<"/projects/[projectId]">) => {
  // oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell.
  const route = Promise.all([params, searchParams]).then(
    ([{ projectId }, query]) => ({
      initialTaskId: parseTaskIdParam(query["task"]),
      projectId,
      query: parseProjectDetailQuery(query),
    })
  );
  return (
    <PageTransition>
      <div className="page flush">
        <SectionErrorBoundary title="Project navigation could not be prepared">
          <Suspense fallback={null}>
            <DynamicMetadataMarker />
          </Suspense>
        </SectionErrorBoundary>
        <SectionErrorBoundary title="Project details could not be loaded">
          <SuspenseReveal fallback={<ProjectHeaderSkeleton />}>
            {/* oxlint-disable-next-line promise/prefer-await-to-then -- Route values resolve inside the boundary. */}
            {route.then(({ projectId, query }) => (
              <ProjectHeader projectId={projectId} requestedView={query.view} />
            ))}
          </SuspenseReveal>
        </SectionErrorBoundary>
        <SectionErrorBoundary title="This project view could not be loaded">
          <SuspenseReveal fallback={<ProjectBodySkeleton />}>
            {/* oxlint-disable-next-line promise/prefer-await-to-then -- Route values resolve inside the boundary. */}
            {route.then(({ initialTaskId, projectId, query }) => (
              <SuspenseReveal
                fallback={<ProjectBodySkeleton view={query.view} />}
              >
                <ProjectBody
                  initialTaskId={initialTaskId}
                  projectId={projectId}
                  query={query}
                />
              </SuspenseReveal>
            ))}
          </SuspenseReveal>
        </SectionErrorBoundary>
      </div>
    </PageTransition>
  );
};

export default ProjectPage;
