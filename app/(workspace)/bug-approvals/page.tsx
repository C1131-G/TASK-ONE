/* eslint-disable shadcn/no-restyle, shadcn/no-unknown-classes -- Bug screens use reference workspace styles from workspace-reference.css. */

import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { listBugsAction } from "@/app/actions/bugs";
import { BugList } from "@/components/workspace/bug-list";
import { getPageSession } from "@/src/server/auth/page-session";

export const metadata: Metadata = { title: "Bug approvals | Metsys" };

const BugApprovalInbox = async () => {
  await connection();
  const session = await getPageSession();
  if (session.kind !== "authenticated" || session.user.role !== "admin") {
    redirect("/bugs" as Route);
  }
  const result = await listBugsAction({ status: "awaiting_admin_approval" });
  return (
    <section aria-labelledby="bug-approvals-heading" className="page bug-page">
      <header className="bug-page-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 id="bug-approvals-heading">Bug approvals</h1>
          <p className="muted">
            Review verified fixes and their before and after evidence.
          </p>
        </div>
      </header>
      {result.ok ? (
        <BugList
          bugs={result.data}
          emptyMessage="No bug fixes are waiting for approval."
        />
      ) : (
        <section className="panel panel-b" role="alert">
          The approval inbox could not be loaded.
        </section>
      )}
    </section>
  );
};

const BugApprovalLoading = () => (
  <output aria-busy="true" aria-live="polite" className="panel panel-b muted">
    Loading approvals…
  </output>
);

const BugApprovalPage = () => (
  <div className="page flush">
    <Suspense fallback={<BugApprovalLoading />}>
      <BugApprovalInbox />
    </Suspense>
  </div>
);

export default BugApprovalPage;
