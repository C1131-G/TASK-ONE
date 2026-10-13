/* eslint-disable shadcn/no-unknown-classes -- Bug screens use reference workspace styles from workspace-reference.css. */

import type { Metadata } from "next";
import { Suspense } from "react";

import {
  BugApprovalList,
  BugApprovalListSkeleton,
} from "@/features/bugs/components/bug-approval-list";

export const metadata: Metadata = { title: "Bug approvals | Metsys" };
export const instant = false;

const BugApprovalPage = () => (
  <div className="page flush">
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
      <Suspense fallback={<BugApprovalListSkeleton />}>
        <BugApprovalList />
      </Suspense>
    </section>
  </div>
);

export default BugApprovalPage;
