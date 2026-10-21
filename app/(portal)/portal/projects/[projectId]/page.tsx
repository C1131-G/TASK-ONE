/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import type { Metadata } from "next";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import {
  PortalProjectView,
  PortalProjectViewSkeleton,
} from "@/features/portal/components/portal-project-view";
import { getPortalSharedProjectById } from "@/features/portal/portal-queries";

export const generateMetadata = async ({
  params,
}: PageProps<"/portal/projects/[projectId]">): Promise<Metadata> => {
  const { projectId } = await params;
  const result = await getPortalSharedProjectById(projectId);
  return { title: `${result.ok ? result.data.name : "Project"} | Metsys` };
};

const Page = ({ params }: PageProps<"/portal/projects/[projectId]">) => (
  <PageTransition>
    <div className="page">
      <SectionErrorBoundary title="Project details couldn't load">
        <SuspenseReveal fallback={<PortalProjectViewSkeleton />}>
          {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
          {params.then(({ projectId }) => (
            <PortalProjectView projectId={projectId} />
          ))}
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default Page;
