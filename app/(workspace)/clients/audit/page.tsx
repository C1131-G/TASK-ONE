/* eslint-disable shadcn/no-unknown-classes */

import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import { parseFilters } from "@/features/clients/components/audit-log-parse";
import {
  AuditLogView,
  AuditLogSkeleton,
} from "@/features/clients/components/audit-log-view";

export const metadata: Metadata = { title: "Audit log | Metsys" };

const AuditLogPage = ({ searchParams }: PageProps<"/clients/audit">) => (
  <PageTransition>
    <div className="page">
      <div className="clients-workspace">
        <Link
          className="clients-back"
          href="/clients"
          transitionTypes={["nav-back"]}
        >
          <ArrowLeft aria-hidden="true" size={14} />
          All clients
        </Link>
        <div className="ph">
          <div>
            <h1>Audit log</h1>
            <p>Sign-ins, lockouts, account changes and portal previews.</p>
          </div>
        </div>
        <SectionErrorBoundary title="audit could not be loaded">
          <SuspenseReveal fallback={<AuditLogSkeleton />}>
            {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
            {searchParams.then((params) => (
              <AuditLogView filters={parseFilters(params)} />
            ))}
          </SuspenseReveal>
        </SectionErrorBoundary>
      </div>
    </div>
  </PageTransition>
);

export default AuditLogPage;
