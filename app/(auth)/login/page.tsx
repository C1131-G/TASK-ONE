import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthCard } from "@/features/user/components/auth-card";
import {
  LoginForm,
  LoginFormSkeleton,
} from "@/features/user/components/login-form";
import { getPageSession } from "@/src/server/auth/page-session";

export const metadata: Metadata = {
  description: "Sign in to your Metsys workspace.",
  title: "Sign in | Metsys",
};

const CHANGE_PASSWORD_PATH: Route<"/change-password"> = "/change-password";
const WORKSPACE_PATH: Route = "/";
const PORTAL_PATH: Route = "/portal";

const INACTIVITY_NOTICE =
  "You were signed out after 2 hours of inactivity. Sign in again to continue.";

const LoginRedirect = async ({ notice }: { readonly notice: string }) => {
  const session = await getPageSession();
  if (session.kind === "authenticated") {
    if (session.user.mustChangePassword) {
      redirect(CHANGE_PASSWORD_PATH);
    }
    redirect(session.user.role === "client" ? PORTAL_PATH : WORKSPACE_PATH);
  }
  return <LoginForm notice={notice} />;
};

const Page = ({ searchParams }: PageProps<"/login">) => (
  <AuthCard
    description="Sign in to your Metsys workspace"
    title="Welcome back"
    titleId="login-title"
  >
    <Suspense fallback={<LoginFormSkeleton />}>
      {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
      {searchParams.then(({ reason }) => (
        <LoginRedirect
          notice={
            (Array.isArray(reason) ? reason[0] : reason) === "inactivity"
              ? INACTIVITY_NOTICE
              : ""
          }
        />
      ))}
    </Suspense>
  </AuthCard>
);

export default Page;
