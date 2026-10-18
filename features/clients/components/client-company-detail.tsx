/* eslint-disable shadcn/no-restyle -- Skeletons reuse the workspace tab and input classes. */
/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in app/workspace-styles. */

import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SkeletonBone,
  SkeletonDataGrid,
} from "@/components/workspace/skeleton-shapes";
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

const USER_COLUMNS = ["User", "Status", "Last active", "Actions"] as const;

// Mirrors ClientCompanyWorkspace: titles, the logo copy, tab names and column
// headings are static; the company, counts and users are data.
const ClientCompanyDetailSkeleton = () => (
  <div className="clients-workspace">
    <Link className="clients-back" href="/clients">
      <ArrowLeft aria-hidden="true" size={14} />
      All clients
    </Link>
    <header className="ph clients-heading">
      <div>
        <p className="eyebrow">Client company</p>
        <div className="clients-title">
          <SkeletonBone shape="title" />
        </div>
        <p>
          <SkeletonBone />
        </p>
      </div>
    </header>
    <section className="panel clients-panel">
      <div className="panel-h clients-panel-h">
        <div>
          <h2>Logo</h2>
          <p className="muted">
            Shown next to the company name in the client portal. PNG, JPEG, or
            WebP up to 2 MB.
          </p>
        </div>
      </div>
    </section>
    <Tabs className="clients-tabs" value="users">
      <TabsList inert>
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="projects">Projects</TabsTrigger>
        <TabsTrigger value="handlers">Handlers</TabsTrigger>
        <TabsTrigger value="bugs">Bugs summary</TabsTrigger>
        <TabsTrigger value="insight">Insight</TabsTrigger>
      </TabsList>
    </Tabs>
    <section className="panel clients-panel">
      <div className="panel-h clients-panel-h">
        <div>
          <h2>Users</h2>
          <p className="muted">Read-only preview; recorded in the audit log.</p>
        </div>
      </div>
      <SkeletonDataGrid
        columns={USER_COLUMNS}
        label="Loading client company…"
        rows={4}
        widths="2fr 1fr 1.5fr 2.5fr"
      />
    </section>
  </div>
);

export { ClientCompanyDetailView, ClientCompanyDetailSkeleton };
