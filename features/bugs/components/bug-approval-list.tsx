/* eslint-disable shadcn/no-unknown-classes -- Bug screens use app/workspace-styles. */

import type { Route } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
import { listBugs } from "@/features/bugs/bugs-queries";
import { BugList } from "@/features/bugs/components/bug-list";
import { getPageSession } from "@/src/server/auth/page-session";

const BugApprovalList = async () => {
  await connection();
  const session = await getPageSession();
  if (session.kind !== "authenticated" || session.user.role !== "admin") {
    redirect("/bugs" as Route);
  }
  const result = await listBugs({ status: "awaiting_admin_approval" });
  return result.ok ? (
    <BugList
      bugs={result.data}
      emptyMessage="No bug fixes are waiting for approval."
    />
  ) : (
    <section className="panel panel-b" role="alert">
      The approval inbox could not be loaded.
    </section>
  );
};

const BugApprovalListSkeleton = () => (
  <PanelSkeleton label="Loading approvals…" rows={4} />
);

export { BugApprovalList, BugApprovalListSkeleton };
