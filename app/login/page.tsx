/* eslint-disable shadcn/no-unknown-classes -- Auth screens are styled by app/auth.css. */

import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/login-form";
import { getPageSession } from "@/src/server/auth/page-session";

export const metadata: Metadata = {
  description: "Sign in to your Metsys workspace.",
  title: "Sign in | Metsys",
};

const CHANGE_PASSWORD_PATH: Route<"/change-password"> = "/change-password";
const WORKSPACE_PATH: Route = "/";

const LoginContent = async () => {
  const session = await getPageSession();
  if (session.kind === "authenticated") {
    redirect(
      session.user.mustChangePassword ? CHANGE_PASSWORD_PATH : WORKSPACE_PATH
    );
  }

  return (
    <AuthShell
      actions={
        <Link className="auth-ghost" href="/signup">
          Request access
        </Link>
      }
      mainId="login-main"
      page="login"
    >
      <LoginForm />
    </AuthShell>
  );
};

const Page = () => (
  <Suspense
    fallback={
      <AuthShell mainId="login-main" page="login">
        <p aria-live="polite" className="auth-hint">
          Checking your session…
        </p>
      </AuthShell>
    }
  >
    <LoginContent />
  </Suspense>
);

export default Page;
