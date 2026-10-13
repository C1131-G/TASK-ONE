/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in app/workspace-styles. */

import type { Route } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { listNotificationInbox } from "@/features/notifications/notifications-queries";
import { listEmployees } from "@/features/people/people-queries";
import { listProjects } from "@/features/projects/projects-queries";
import { getPageSession } from "@/src/server/auth/page-session";

// The shell's server half: it gates the session and loads the navigation data.
const LOGIN_PATH: Route = "/login";
const CHANGE_PASSWORD_PATH: Route = "/change-password";

const WorkspaceFrame = async ({
  children,
}: {
  readonly children: ReactNode;
}) => {
  await connection();
  const session = await getPageSession();
  if (session.kind === "anonymous") {
    redirect(LOGIN_PATH);
  }
  if (session.user.mustChangePassword) {
    redirect(CHANGE_PASSWORD_PATH);
  }

  const [projectResult, employeeResult, notificationResult] = await Promise.all(
    [
      listProjects({}),
      listEmployees({ search: "" }),
      listNotificationInbox({ limit: 1, unreadOnly: false }),
    ]
  );
  const projects = projectResult.ok ? projectResult.data : [];
  const employee = employeeResult.ok
    ? employeeResult.data.find((item) => item.id === session.user.id)
    : null;

  return (
    <WorkspaceShell
      name={
        employee?.name ??
        `EMP${String(session.user.employeeNumber).padStart(6, "0")}`
      }
      projects={projects.map((project) => ({
        color: project.color,
        icon: project.icon,
        id: project.id,
        name: project.name,
      }))}
      publicKey={process.env["VAPID_PUBLIC_KEY"] ?? ""}
      role={session.user.role}
      unreadInboxCount={
        notificationResult.ok ? notificationResult.data.unreadInboxCount : 0
      }
      unreadNotificationCount={
        notificationResult.ok ? notificationResult.data.unreadCount : 0
      }
    >
      {children}
    </WorkspaceShell>
  );
};

// Mirrors the shell's sidebar, top bar and page frame while the session loads.
const WorkspaceFrameSkeleton = () => (
  <div aria-busy="true" className="workspace-app workspace-loading">
    <output aria-live="polite" className="sr-only">
      Loading workspace
    </output>
    <aside aria-hidden="true" className="workspace-loading-sidebar">
      <div className="workspace-loading-brand" />
      <div className="workspace-loading-nav" />
      <div className="workspace-loading-nav" />
      <div className="workspace-loading-nav" />
      <div className="workspace-loading-nav" />
    </aside>
    <div aria-hidden="true" className="workspace-loading-main">
      <div className="workspace-loading-topbar" />
      <main className="workspace-loading-page">
        <div className="workspace-loading-heading" />
        <div className="workspace-loading-panel" />
      </main>
    </div>
  </div>
);

export { WorkspaceFrame, WorkspaceFrameSkeleton };
