import type { ReactNode } from "react";

import { IntakeShell } from "@/features/intake/components/intake-shell";

const IntakeLayout = ({ children }: { readonly children: ReactNode }) => (
  <IntakeShell>{children}</IntakeShell>
);

export default IntakeLayout;
