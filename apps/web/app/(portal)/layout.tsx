import { Suspense } from "react";

import { PortalAccessGate } from "@/features/portal/components/portal-gate";
import { PortalShell } from "@/features/portal/components/portal-shell";
import { RealtimeRefresh } from "@/features/realtime/realtime-refresh";

import "../workspace-styles/workspace-styles";

const PortalLayout = ({ children }: LayoutProps<"/">) => (
  <>
    <Suspense fallback={null}>
      <PortalAccessGate />
    </Suspense>
    <RealtimeRefresh />
    <PortalShell>{children}</PortalShell>
  </>
);

export default PortalLayout;
