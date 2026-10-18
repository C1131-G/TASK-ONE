/* eslint-disable shadcn/no-unknown-classes -- Skeletons mirror the audit log markup. */

import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import {
  SkeletonBone,
  SkeletonDataGrid,
} from "@/components/workspace/skeleton-shapes";
import { parseFilters } from "@/features/clients/components/audit-log-parse";
import { AuditFilters } from "@/features/clients/components/audit-log-parts";

const COLUMNS = [
  "Time",
  "Event",
  "Person",
  "By",
  "IP",
  "Device",
  "Details",
] as const;

// Mirrors AuditLogView: heading, locked-accounts copy, the filter form and the
// column titles are static; only the event rows are data.
const AuditLogSkeleton = () => (
  <div className="clients-workspace">
    <Link className="clients-back" href="/clients">
      <ArrowLeft aria-hidden="true" size={14} />
      All clients
    </Link>
    <div className="ph">
      <div>
        <h1>Audit log</h1>
        <p>Sign-ins, lockouts, account changes and portal previews.</p>
      </div>
    </div>
    <section aria-label="Locked accounts" className="panel clients-panel">
      <div className="panel-h clients-panel-h">
        <div>
          <h2>Locked accounts</h2>
          <p className="muted">
            Accounts lock for 15 minutes after 5 failed sign-ins.
          </p>
        </div>
      </div>
      <p className="panel-b muted">
        <SkeletonBone shape="short" />
      </p>
    </section>
    <div inert>
      <AuditFilters filters={parseFilters({})} />
    </div>
    <section aria-label="Audit events" className="panel clients-panel">
      <SkeletonDataGrid
        columns={COLUMNS}
        label="Loading audit events…"
        rows={12}
        widths="1.4fr 1.2fr 1.5fr 1fr 1fr 2fr 0.8fr"
      />
    </section>
  </div>
);

export { AuditLogSkeleton };
