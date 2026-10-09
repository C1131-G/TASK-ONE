import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

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
    <>
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50"
        href="#signup-main"
      >
        Skip to main content
      </a>
      <main
        className="auth-backdrop flex min-h-svh flex-col items-center justify-center p-4 md:p-8"
        id="signup-main"
        tabIndex={-1}
      >
        <div className="w-full max-w-sm md:max-w-4xl">
          <SignupForm />
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
    <SignupContent />
  </Suspense>
);

export default Page;
