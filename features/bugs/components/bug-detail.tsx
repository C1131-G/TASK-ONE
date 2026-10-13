/* eslint-disable shadcn/no-unknown-classes -- Workspace page classes are authored in workspace-reference.css. */

import { notFound } from "next/navigation";
import { connection } from "next/server";

import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
import { getBugHistory } from "@/features/bugs/bugs-queries";
import { BugDetailWorkflow } from "@/features/bugs/components/bug-detail-workflow";
import { listEmployees } from "@/features/people/people-queries";
import { getPageSession } from "@/src/server/auth/page-session";

const BugDetail = async ({ bugId }: { readonly bugId: string }) => {
  await connection();
  const [session, employeesResult, historyResult] = await Promise.all([
    getPageSession(),
    listEmployees({ search: "" }),
    getBugHistory({ bugId }),
  ]);
  if (session.kind !== "authenticated") {
    notFound();
  }
  if (!historyResult.ok) {
    if (historyResult.error.code === "NOT_FOUND") {
      notFound();
    }
    return (
      <div className="page">
        <section className="panel panel-b" role="alert">
          Bug details could not be loaded. Refresh to retry.
        </section>
      </div>
    );
  }
  return (
    <BugDetailWorkflow
      employees={
        employeesResult.ok
          ? employeesResult.data.map(({ id, name }) => ({ id, name }))
          : []
      }
      history={historyResult.data}
      isAdmin={session.user.role === "admin"}
      key={`${historyResult.data.bug.id}:${historyResult.data.bug.version}`}
      userId={session.user.id}
    />
  );
};

const BugDetailSkeleton = () => (
  <div className="page">
    <PanelSkeleton label="Loading bug details…" rows={6} title="Bug details" />
  </div>
);

export { BugDetail, BugDetailSkeleton };
