import { WorkspaceFrame } from "@/components/workspace/workspace-frame";
import { RealtimeRefresh } from "@/features/realtime/realtime-refresh";

import "../workspace-styles/workspace-styles";

// The frame renders without waiting on the session; its own boundaries stream
// the navigation data, and pages keep their own loading states.
const WorkspaceLayout = ({ children }: LayoutProps<"/">) => (
  <>
    <RealtimeRefresh />
    <WorkspaceFrame>{children}</WorkspaceFrame>
  </>
);

export default WorkspaceLayout;
