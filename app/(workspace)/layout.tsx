/* eslint-disable shadcn/no-unknown-classes */

import type { Route } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { Suspense } from "react";

import { listEmployeesAction } from "@/app/actions/employees";
import { listNotificationInboxAction } from "@/app/actions/notifications";
import { listProjectsAction } from "@/app/actions/projects";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { getPageSession } from "@/src/server/auth/page-session";

import "../workspace-reference.css";

const LOGIN_PATH: Route = "/login";
const CHANGE_PASSWORD_PATH: Route = "/change-password";

const WorkspaceContent = async ({
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
      listProjectsAction({}),
      listEmployeesAction({ search: "" }),
      listNotificationInboxAction({ limit: 1, unreadOnly: false }),
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

const WorkspaceLoading = () => (
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

const WorkspaceLayout = ({ children }: { readonly children: ReactNode }) => (
  <Suspense fallback={<WorkspaceLoading />}>
    <WorkspaceContent>{children}</WorkspaceContent>
  </Suspense>
);

export default WorkspaceLayout;
