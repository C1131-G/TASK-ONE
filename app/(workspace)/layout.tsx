import type { ReactNode } from "react";
import { Suspense } from "react";

import {
  WorkspaceFrame,
  WorkspaceFrameSkeleton,
} from "@/features/workspace/components/workspace-frame";

import "../workspace-styles/workspace-styles";

// The shell repeats on every workspace route, so its boundary lives here.
const WorkspaceLayout = ({ children }: { readonly children: ReactNode }) => (
  <Suspense fallback={<WorkspaceFrameSkeleton />}>
    <WorkspaceFrame>{children}</WorkspaceFrame>
  </Suspense>
);

export default WorkspaceLayout;
