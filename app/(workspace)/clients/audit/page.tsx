/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { Suspense } from "react";

import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { parseFilters } from "@/features/clients/components/audit-log-parse";
import { AuditLogView } from "@/features/clients/components/audit-log-view";
import { AuditLogSkeleton } from "@/features/clients/components/audit-skeleton";

export const metadata: Metadata = { title: "Audit log | Metsys" };

const AuditLogPage = ({ searchParams }: PageProps<"/clients/audit">) => (
  <div className="page">
    <SectionErrorBoundary title="audit could not be loaded">
      <Suspense fallback={<AuditLogSkeleton />}>
        {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
        {searchParams.then((params) => (
          <AuditLogView filters={parseFilters(params)} />
        ))}
      </Suspense>
    </SectionErrorBoundary>
  </div>
);

export default AuditLogPage;
