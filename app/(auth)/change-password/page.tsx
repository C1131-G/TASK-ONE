import { Password } from "@phosphor-icons/react/dist/ssr";
import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";

import { PageTransition } from "@/components/ui/page-transition";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import { AuthCard } from "@/features/user/components/auth-card";
import {
  ChangePasswordForm,
  ChangePasswordFormSkeleton,
} from "@/features/user/components/change-password-form";
import { getPageSession } from "@/src/server/auth/page-session";

export const metadata: Metadata = {
  description: "Change the temporary password for your Metsys account.",
  title: "Set your password | Metsys",
};

const LOGIN_PATH: Route = "/login";
const WORKSPACE_PATH: Route = "/";
const PORTAL_PATH: Route = "/portal";

const PasswordChangeGate = async () => {
  const session = await getPageSession();
  if (session.kind === "anonymous") {
    redirect(LOGIN_PATH);
  }
  if (!session.user.mustChangePassword) {
    redirect(session.user.role === "client" ? PORTAL_PATH : WORKSPACE_PATH);
  }
  return <ChangePasswordForm />;
};

const Page = () => (
  <PageTransition>
    <AuthCard
      badge={<Password size={22} weight="duotone" />}
      description="Replace your temporary password to open your workspace."
      title="Set a new password"
      titleId="password-title"
    >
      <SuspenseReveal fallback={<ChangePasswordFormSkeleton />}>
        <PasswordChangeGate />
      </SuspenseReveal>
    </AuthCard>
  </PageTransition>
);

export default Page;
