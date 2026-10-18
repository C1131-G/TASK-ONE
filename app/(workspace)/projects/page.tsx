/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { Suspense } from "react";

import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { ProjectDirectorySkeleton } from "@/features/projects/components/directory-skeleton";
import { ProjectDirectory } from "@/features/projects/components/project-directory";
import { parseProjectFilters } from "@/features/projects/project-filters";

export const metadata: Metadata = { title: "Projects | Metsys" };

const ProjectsPage = ({ searchParams }: PageProps<"/projects">) => (
  <div className="page">
    <SectionErrorBoundary title="projects could not be loaded">
      <Suspense fallback={<ProjectDirectorySkeleton />}>
        {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
        {searchParams.then((params) => (
          <ProjectDirectory filters={parseProjectFilters(params)} />
        ))}
      </Suspense>
    </SectionErrorBoundary>
  </div>
);

export default ProjectsPage;
