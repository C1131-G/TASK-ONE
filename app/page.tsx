import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PushNotificationsControl } from "@/components/push-notifications-control";
import { SignOutButton } from "@/components/sign-out-button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getPageSession } from "@/src/server/auth/page-session";

export const metadata: Metadata = {
  description: "Your Metsys team workspace.",
  title: "Workspace | Metsys",
};

const LOGIN_PATH: Route = "/login";
const CHANGE_PASSWORD_PATH: Route = "/change-password";

const WorkspaceContent = async () => {
  const session = await getPageSession();
  if (session.kind === "anonymous") {
    redirect(LOGIN_PATH);
  }
  if (session.user.mustChangePassword) {
    redirect(CHANGE_PASSWORD_PATH);
  }

  return (
    <>
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50"
        href="#workspace-main"
      >
        Skip to main content
      </a>
      <main
        className="auth-backdrop flex min-h-svh flex-col items-center justify-center gap-6 p-4"
        id="workspace-main"
        tabIndex={-1}
      >
        <Card className="w-full max-w-xl">
          <CardHeader>
            <p className="text-xs font-semibold tracking-widest text-primary uppercase">
              Metsys workspace
            </p>
            <h1 className="font-heading text-2xl font-semibold">
              Welcome to Metsys
            </h1>
            <p className="text-sm text-muted-foreground">
              Your workspace account is ready. The team workspace is being
              prepared.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6">
              <dl className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border bg-muted/50 p-4">
                  <dt className="text-sm text-muted-foreground">Employee ID</dt>
                  <dd className="mt-1 font-semibold">
                    EMP{String(session.user.employeeNumber).padStart(6, "0")}
                  </dd>
                </div>
                <div className="rounded-2xl border bg-muted/50 p-4">
                  <dt className="text-sm text-muted-foreground">Access</dt>
                  <dd className="mt-1 font-semibold">
                    {session.user.role === "admin" ? "Admin" : "Employee"}
                  </dd>
                </div>
              </dl>
              <SignOutButton />
            </div>
          </CardContent>
        </Card>
        <PushNotificationsControl
          publicKey={process.env["VAPID_PUBLIC_KEY"] ?? ""}
        />
      </main>
    </>
  );
};

const Page = () => (
  <Suspense
    fallback={
      <main className="flex min-h-svh items-center justify-center bg-muted p-4">
        <p aria-live="polite">Loading your workspace…</p>
      </main>
    }
  >
    <WorkspaceContent />
  </Suspense>
);

export default Page;
