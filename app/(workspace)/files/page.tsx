/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { Suspense } from "react";

import {
  WorkspaceFiles,
  WorkspaceFilesSkeleton,
} from "@/features/files/components/workspace-files";

export const metadata: Metadata = { title: "Files | Metsys" };
export const instant = false;

const FilesPage = () => (
  <div className="page wide">
    <div className="ph">
      <div>
        <h1>Files</h1>
        <p>Files shared with your projects.</p>
      </div>
    </div>
    <Suspense fallback={<WorkspaceFilesSkeleton />}>
      <WorkspaceFiles />
    </Suspense>
  </div>
);

export default FilesPage;
