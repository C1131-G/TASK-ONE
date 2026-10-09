import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthBrand } from "@/components/auth-brand";
import { ChangePasswordForm } from "@/components/change-password-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
    <>
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50"
        href="#password-main"
      >
        Skip to main content
      </a>
      <main
        className="auth-backdrop flex min-h-svh items-center justify-center px-4 py-2 sm:py-4"
        id="password-main"
        tabIndex={-1}
      >
        <div className="w-full max-w-md">
          <div className="mb-2 flex justify-center">
            <AuthBrand />
          </div>
          <Card className="w-full" size="sm">
            <CardHeader>
              <h1 className="font-heading text-xl font-semibold">
                Set a new password
              </h1>
              <p className="text-sm leading-5 text-muted-foreground">
                Change your temporary password to continue to your workspace.
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <ChangePasswordForm />
                <Link
                  className="text-sm underline underline-offset-4"
                  href="/login"
                >
                  Sign out and return to sign in
                </Link>
              </div>
            </CardContent>
          </Card>
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
    <ChangePasswordContent />
  </Suspense>
);

export default Page;
