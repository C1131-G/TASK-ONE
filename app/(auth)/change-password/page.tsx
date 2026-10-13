import { Password } from "@phosphor-icons/react/dist/ssr";
import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

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

const PasswordChangeGate = async () => {
  const session = await getPageSession();
  if (session.kind === "anonymous") {
    redirect(LOGIN_PATH);
  }
  if (!session.user.mustChangePassword) {
    redirect(WORKSPACE_PATH);
  }
  return <ChangePasswordForm />;
};

const Page = () => (
  <AuthCard
    badge={<Password size={22} weight="duotone" />}
    description="Replace your temporary password to open your workspace."
    title="Set a new password"
    titleId="password-title"
  >
    <Suspense fallback={<ChangePasswordFormSkeleton />}>
      <PasswordChangeGate />
    </Suspense>
  </AuthCard>
);

export default Page;
