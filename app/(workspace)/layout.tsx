import type { ReactNode } from "react";

import { WorkspaceFrame } from "@/features/workspace/components/workspace-frame";

import "../workspace-styles/workspace-styles";

// The frame renders without waiting on the session; its own boundaries stream
// the navigation data, and pages keep their own loading states.
const WorkspaceLayout = ({ children }: { readonly children: ReactNode }) => (
  <WorkspaceFrame>{children}</WorkspaceFrame>
);

export default WorkspaceLayout;
