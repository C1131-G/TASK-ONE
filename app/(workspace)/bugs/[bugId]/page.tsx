/* eslint-disable shadcn/no-unknown-classes -- Workspace page classes are authored in workspace-reference.css. */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { getBugHistoryAction } from "@/app/actions/bugs";
import { listEmployeesAction } from "@/app/actions/employees";
import { BugDetailWorkflow } from "@/components/workspace/bug-detail-workflow";
import { getPageSession } from "@/src/server/auth/page-session";

export const metadata: Metadata = { title: "Bug details | Metsys" };

const BugDetailContent = async ({
  params,
}: {
  readonly params: Promise<{ bugId: string }>;
}) => {
  await connection();
  const [session, employeesResult, historyResult] = await Promise.all([
    getPageSession(),
    listEmployeesAction({ search: "" }),
    params.then(({ bugId }) => getBugHistoryAction({ bugId })),
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

const BugDetailLoading = () => (
  <output aria-busy="true" aria-live="polite" className="panel panel-b muted">
    Loading bug details…
  </output>
);

const BugDetailPage = ({
  params,
}: {
  readonly params: Promise<{ bugId: string }>;
}) => (
  <div className="page flush">
    <Suspense fallback={<BugDetailLoading />}>
      <BugDetailContent params={params} />
    </Suspense>
  </div>
);

export default BugDetailPage;
