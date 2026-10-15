import type { ReactNode } from "react";
import { Suspense } from "react";

import { PortalAccessGate } from "@/features/portal/components/portal-gate";
import { PortalShell } from "@/features/portal/components/portal-shell";

import "../workspace-styles/workspace-styles";

const PortalLayout = ({ children }: { readonly children: ReactNode }) => (
  <>
    <Suspense fallback={null}>
      <PortalAccessGate />
    </Suspense>
    <PortalShell>{children}</PortalShell>
  </>
);

export default PortalLayout;
