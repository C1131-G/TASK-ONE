/* eslint-disable shadcn/no-unknown-classes -- Auth screens are styled by app/auth.css. */

import { Password } from "@phosphor-icons/react/dist/ssr";
import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { AuthSignOutButton } from "@/components/auth/auth-sign-out-button";
import { ChangePasswordForm } from "@/components/change-password-form";
import { getPageSession } from "@/src/server/auth/page-session";

export const metadata: Metadata = {
  description: "Change the temporary password for your Metsys account.",
  title: "Set your password | Metsys",
};

const LOGIN_PATH: Route = "/login";
const WORKSPACE_PATH: Route = "/";

const ChangePasswordContent = async () => {
  const session = await getPageSession();
  if (session.kind === "anonymous") {
    redirect(LOGIN_PATH);
  }
  if (!session.user.mustChangePassword) {
    redirect(WORKSPACE_PATH);
  }

  return (
    <AuthShell
      actions={<AuthSignOutButton />}
      mainId="password-main"
      page="change-password"
    >
      <section aria-labelledby="password-title" className="auth-card">
        <div className="auth-head">
          <span aria-hidden="true" className="auth-badge">
            <Password size={22} weight="duotone" />
          </span>
          <h1 id="password-title">Set a new password</h1>
          <p>Replace your temporary password to open your workspace.</p>
        </div>
        <ChangePasswordForm />
      </section>
    </AuthShell>
  );
};

const Page = () => (
  <Suspense
    fallback={
      <AuthShell mainId="password-main" page="change-password">
        <p aria-live="polite" className="auth-hint">
          Checking your session…
        </p>
      </AuthShell>
    }
  >
    <ChangePasswordContent />
  </Suspense>
);

export default Page;
