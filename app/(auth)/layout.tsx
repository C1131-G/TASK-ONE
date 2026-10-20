import { AuthShell } from "@/features/user/components/auth-shell";

const AuthLayout = ({ children }: LayoutProps<"/">) => (
  <AuthShell>{children}</AuthShell>
);

export default AuthLayout;
