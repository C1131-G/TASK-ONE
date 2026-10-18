/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in app/workspace-styles. */

import { notFound, redirect } from "next/navigation";

import { getClientCompanyOnce } from "@/features/clients/client-company-metadata";
import { ClientCompanyWorkspace } from "@/features/clients/components/client-company-workspace";
import { listAllEmployees } from "@/features/people/people-queries";
import { listProjects } from "@/features/projects/projects-queries";
import { getPageSession } from "@/src/server/auth/page-session";

const ClientCompanyDetailView = async ({
  companyId,
}: {
  readonly companyId: string;
}) => {
  const session = await getPageSession();
  if (session.kind !== "authenticated" || session.user.role !== "admin") {
    redirect("/");
  }
  const [result, projectsResult, employeesResult] = await Promise.all([
    getClientCompanyOnce(companyId),
    listProjects({}),
    listAllEmployees(),
  ]);
  if (!result.ok) {
    if (
      result.error.code === "NOT_FOUND" ||
      result.error.code === "VALIDATION_FAILED"
    ) {
      notFound();
    }
    return (
      <div className="panel panel-b" role="alert">
        The client company could not be loaded. Refresh to retry.
      </div>
    );
  }
  if (!projectsResult.ok || !employeesResult.ok) {
    return (
      <div className="panel panel-b" role="alert">
        Projects or employees could not be loaded. Refresh to retry.
      </div>
    );
  }
  return (
    <ClientCompanyWorkspace
      detail={result.data}
      employeeOptions={employeesResult.data.map(({ email, id, name }) => ({
        email,
        id,
        name,
      }))}
      projectOptions={projectsResult.data.flatMap(
        ({ archivedAt, id, key, name }) =>
          archivedAt === null ? [{ id, key, name }] : []
      )}
    />
  );
};

export { ClientCompanyDetailView };
