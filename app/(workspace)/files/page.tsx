/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { Suspense } from "react";

import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { WorkspaceFilesSkeleton } from "@/features/files/components/files-skeleton";
import { WorkspaceFiles } from "@/features/files/components/workspace-files";

export const metadata: Metadata = { title: "Files | Metsys" };

const FilesPage = () => (
  <div className="page wide">
    <div className="ph">
      <div>
        <h1>Files</h1>
        <p>Files shared with your projects.</p>
      </div>
    </div>
    <SectionErrorBoundary title="files could not be loaded">
      <Suspense fallback={<WorkspaceFilesSkeleton />}>
        <WorkspaceFiles />
      </Suspense>
    </SectionErrorBoundary>
  </div>
);

export default FilesPage;
