import type { Route } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Suspense } from "react";

import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import type { WorkspaceFrameData } from "@/components/workspace/workspace-shell";
import { listNotificationInbox } from "@/features/notifications/notifications-queries";
import { listAllEmployees } from "@/features/people/people-queries";
import { listProjects } from "@/features/projects/projects-queries";
import { getPageSession } from "@/src/server/auth/page-session";
import { isWorkspaceUser } from "@/src/server/auth/session";

const LOGIN_PATH: Route = "/login";
const CHANGE_PASSWORD_PATH: Route = "/change-password";
const PORTAL_PATH: Route = "/portal";

// Resolves the session and navigation data for the shell chrome. It returns
// null for visitors the gate below redirects, so no data loads for them.
const loadWorkspaceFrame = async (): Promise<WorkspaceFrameData | null> => {
  const session = await getPageSession();
  if (
    session.kind === "anonymous" ||
    session.user.mustChangePassword ||
    !isWorkspaceUser(session.user)
  ) {
    return null;
  }

  const [projectResult, employeeResult, notificationResult] = await Promise.all(
    [
      listProjects({}),
      listAllEmployees(),
      listNotificationInbox({ limit: 1, unreadOnly: false }),
    ]
  );
  const employee = employeeResult.ok
    ? employeeResult.data.find(({ id }) => id === session.user.id)
    : null;

  return {
    name:
      employee?.name ??
      `EMP${String(session.user.employeeNumber).padStart(6, "0")}`,
    projects: (projectResult.ok ? projectResult.data : []).map((project) => ({
      color: project.color,
      icon: project.icon,
      id: project.id,
      name: project.name,
    })),
    role: session.user.role,
    unreadInboxCount: notificationResult.ok
      ? notificationResult.data.unreadInboxCount
      : 0,
    unreadNotificationCount: notificationResult.ok
      ? notificationResult.data.unreadCount
      : 0,
  };
};

// Sends signed-out visitors to sign in. It renders nothing, so its boundary
// needs no fallback; page data still checks access in its own queries.
const WorkspaceAccessGate = async () => {
  const session = await getPageSession();
  if (session.kind === "anonymous") {
    redirect(LOGIN_PATH);
  }
  if (session.user.mustChangePassword) {
    redirect(CHANGE_PASSWORD_PATH);
  }
  // Client accounts have their own portal and never see the workspace.
  if (!isWorkspaceUser(session.user)) {
    redirect(PORTAL_PATH);
  }
  return null;
};

const WorkspaceFrame = ({ children }: { readonly children: ReactNode }) => (
  <WorkspaceShell
    frame={loadWorkspaceFrame()}
    publicKey={process.env["VAPID_PUBLIC_KEY"] ?? ""}
  >
    <Suspense fallback={null}>
      <WorkspaceAccessGate />
    </Suspense>
    {children}
  </WorkspaceShell>
);

export { WorkspaceFrame };
