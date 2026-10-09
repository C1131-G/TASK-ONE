import type { Route } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { listEmployeesAction } from "@/app/actions/employees";
import { listProjectsAction } from "@/app/actions/projects";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { getPageSession } from "@/src/server/auth/page-session";

import "../workspace-reference.css";

const LOGIN_PATH: Route = "/login";
const CHANGE_PASSWORD_PATH: Route = "/change-password";

const WorkspaceLayout = async ({
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

  const [projectResult, employeeResult] = await Promise.all([
    listProjectsAction({}),
    listEmployeesAction({ search: "" }),
  ]);
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
    >
      {children}
    </WorkspaceShell>
  );
};

export default WorkspaceLayout;
