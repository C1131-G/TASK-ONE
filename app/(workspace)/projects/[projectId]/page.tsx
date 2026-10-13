import type { Metadata } from "next";
import { Suspense } from "react";

import {
  ProjectDetail,
  ProjectDetailSkeleton,
} from "@/features/projects/components/project-detail";
import { parseProjectDetailQuery } from "@/features/projects/project-detail-params";
import { projectMetadata } from "@/features/projects/project-metadata";
import { parseTaskIdParam } from "@/features/tasks/task-param";

export const instant = false;
export const generateMetadata = async ({
  params,
}: PageProps<"/projects/[projectId]">): Promise<Metadata> => {
  const { projectId } = await params;
  return await projectMetadata(projectId);
};

const ProjectPage = ({
  params,
  searchParams,
}: PageProps<"/projects/[projectId]">) => (
  <Suspense fallback={<ProjectDetailSkeleton />}>
    {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
    {Promise.all([params, searchParams]).then(([{ projectId }, query]) => (
      <ProjectDetail
        initialTaskId={parseTaskIdParam(query["task"])}
        projectId={projectId}
        query={parseProjectDetailQuery(query)}
      />
    ))}
  </Suspense>
);

export default ProjectPage;
