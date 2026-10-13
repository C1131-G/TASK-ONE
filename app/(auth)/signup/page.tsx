import { UserPlus } from "@phosphor-icons/react/dist/ssr";
import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthCard } from "@/features/user/components/auth-card";
import { RequestAccessSteps } from "@/features/user/components/request-access-steps";
import { getPageSession } from "@/src/server/auth/page-session";

export const metadata: Metadata = {
  description: "Request an employee account for the Metsys workspace.",
  title: "Request access | Metsys",
};

const WORKSPACE_PATH: Route = "/";
const CHANGE_PASSWORD_PATH: Route<"/change-password"> = "/change-password";

// The steps are static, so only the signed-in redirect waits on the session.
const SignupRedirect = async () => {
  const session = await getPageSession();
  if (session.kind === "authenticated") {
    redirect(
      session.user.mustChangePassword ? CHANGE_PASSWORD_PATH : WORKSPACE_PATH
    );
  }
  return null;
};

const Page = () => (
  <AuthCard
    badge={<UserPlus size={22} weight="duotone" />}
    description="Metsys accounts are created by an administrator."
    title="Request access"
    titleId="signup-title"
  >
    <RequestAccessSteps />
    <Suspense>
      <SignupRedirect />
    </Suspense>
  </AuthCard>
);

export default Page;
