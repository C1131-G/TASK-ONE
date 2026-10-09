import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { LoginForm } from "@/components/login-form";
import { getPageSession } from "@/src/server/auth/page-session";

export const metadata: Metadata = {
  description: "Sign in to your Metsys team workspace.",
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
    <>
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50"
        href="#login-main"
      >
        Skip to main content
      </a>
      <main
        className="auth-backdrop flex min-h-svh items-center justify-center p-4 md:p-6"
        id="login-main"
        tabIndex={-1}
      >
        <div className="w-full max-w-sm md:max-w-4xl">
          <LoginForm />
        </div>
      </main>
    </>
  );
};

const Page = () => (
  <Suspense
    fallback={
      <main className="flex min-h-svh items-center justify-center bg-muted p-4">
        <p aria-live="polite">Checking your session…</p>
      </main>
    }
  >
    <LoginContent />
  </Suspense>
);

export default Page;
