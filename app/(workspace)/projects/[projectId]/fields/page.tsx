/* eslint-disable shadcn/no-unknown-classes */

import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import {
  ProjectCustomFields,
  ProjectCustomFieldsSkeleton,
} from "@/features/custom-fields/components/project-custom-fields";

export const metadata: Metadata = { title: "Custom fields | Metsys" };

const ProjectCustomFieldsPage = ({
  params,
}: PageProps<"/projects/[projectId]/fields">) => (
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
          <h1>Custom fields</h1>
          <p>Extra fields every task in this project can fill in.</p>
        </div>
      </div>
      <SectionErrorBoundary title="Custom fields couldn't load">
        <SuspenseReveal fallback={<ProjectCustomFieldsSkeleton />}>
          {/* oxlint-disable-next-line promise/prefer-await-to-then -- Route values resolve inside the boundary. */}
          {params.then(({ projectId }) => (
            <ProjectCustomFields projectId={projectId} />
          ))}
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default ProjectCustomFieldsPage;
