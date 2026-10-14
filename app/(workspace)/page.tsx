import type { Metadata } from "next";
import { Suspense } from "react";

import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import {
  WorkspaceHome,
  WorkspaceHomeSkeleton,
} from "@/features/dashboard/components/workspace-home";
import { parseHomeTaskView } from "@/features/dashboard/home-task-view";

export const metadata: Metadata = { title: "Home | Metsys" };

const HomePage = ({ searchParams }: PageProps<"/">) => (
  <SectionErrorBoundary title="Your workspace could not be loaded">
    <Suspense fallback={<WorkspaceHomeSkeleton />}>
      {/* oxlint-disable-next-line promise/prefer-await-to-then -- Resolve URL state at the route boundary while keeping the page synchronous. */}
      {searchParams.then((params) => (
        <WorkspaceHome taskView={parseHomeTaskView(params["taskView"])} />
      ))}
    </Suspense>
  </SectionErrorBoundary>
);

export default HomePage;
