/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import {
  WorkspaceFilesSkeleton,
  WorkspaceFiles,
} from "@/features/files/components/workspace-files";

export const metadata: Metadata = { title: "Files | Metsys" };

const FilesPage = () => (
  <PageTransition>
    <div className="page wide">
      <div className="ph">
        <div>
          <h1>Files</h1>
          <p>Files shared with your projects.</p>
        </div>
      </div>
      <SectionErrorBoundary title="Files couldn't load">
        <SuspenseReveal fallback={<WorkspaceFilesSkeleton />}>
          <WorkspaceFiles />
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default FilesPage;
