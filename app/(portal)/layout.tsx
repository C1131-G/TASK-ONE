import type { ReactNode } from "react";
import { Suspense } from "react";

import { PortalAccessGate } from "@/features/portal/components/portal-gate";

import "../workspace-styles/workspace-styles";

const PortalLayout = ({ children }: { readonly children: ReactNode }) => (
  <>
    <Suspense fallback={null}>
      <PortalAccessGate />
    </Suspense>
    {children}
  </>
);

export default PortalLayout;
