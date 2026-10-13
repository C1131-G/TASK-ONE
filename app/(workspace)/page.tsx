import type { Metadata } from "next";
import { Suspense } from "react";

import {
  WorkspaceHome,
  WorkspaceHomeSkeleton,
} from "@/features/dashboard/components/workspace-home";
import { parseHomeTaskView } from "@/features/dashboard/home-task-view";

export const metadata: Metadata = { title: "Home | Metsys" };
export const instant = false;

const HomePage = ({ searchParams }: PageProps<"/">) => (
  <Suspense fallback={<WorkspaceHomeSkeleton />}>
    {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
    {searchParams.then((params) => (
      <WorkspaceHome taskView={parseHomeTaskView(params["taskView"])} />
    ))}
  </Suspense>
);

export default HomePage;
