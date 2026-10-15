/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { Suspense } from "react";

import {
  AuditLogSkeleton,
  AuditLogView,
} from "@/features/clients/components/audit-log-view";

export const metadata: Metadata = { title: "Audit log | Metsys" };

const AuditLogPage = ({ searchParams }: PageProps<"/clients/audit">) => (
  <div className="page">
    <Suspense fallback={<AuditLogSkeleton />}>
      <AuditLogView searchParams={searchParams} />
    </Suspense>
  </div>
);

export default AuditLogPage;
