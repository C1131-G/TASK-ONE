/* eslint-disable shadcn/no-unknown-classes -- Auth screens are styled by app/auth.css. */

import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/signup-form";
import { getPageSession } from "@/src/server/auth/page-session";

export const metadata: Metadata = {
  description: "Request an employee account for the Metsys workspace.",
  title: "Request access | Metsys",
};

const WORKSPACE_PATH: Route = "/";
const CHANGE_PASSWORD_PATH: Route<"/change-password"> = "/change-password";

const SignupContent = async () => {
  const session = await getPageSession();
  if (session.kind === "authenticated") {
    redirect(
      session.user.mustChangePassword ? CHANGE_PASSWORD_PATH : WORKSPACE_PATH
    );
  }

  return (
    <AuthShell
      actions={
        <Link className="auth-ghost" href="/login">
          Sign in
        </Link>
      }
      mainId="signup-main"
      page="signup"
    >
      <SignupForm />
    </AuthShell>
  );
};

const Page = () => (
  <Suspense
    fallback={
      <AuthShell mainId="signup-main" page="signup">
        <p aria-live="polite" className="auth-hint">
          Checking your session…
        </p>
      </AuthShell>
    }
  >
    <SignupContent />
  </Suspense>
);

export default Page;
