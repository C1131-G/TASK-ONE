import type { ReactNode } from "react";

import { AuthShell } from "@/features/user/components/auth-shell";

const AuthLayout = ({ children }: { readonly children: ReactNode }) => (
  <AuthShell>{children}</AuthShell>
);

export default AuthLayout;
