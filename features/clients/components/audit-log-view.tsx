/* eslint-disable shadcn/no-unknown-classes, shadcn/no-restyle -- Workspace classes are defined in app/workspace-styles. */

import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { auditEventLabel } from "@/features/clients/audit-event-types";
import {
  listAuditEvents,
  listLockedAccounts,
} from "@/features/clients/clients-queries";
import { LockedAccountsPanel } from "@/features/clients/components/locked-accounts-panel";
import { getPageSession } from "@/src/server/auth/page-session";

import {
  DEFAULT_LIMIT,
  endOfDay,
  shortenUserAgent,
  timeFormatter,
} from "./audit-log-parse";
import type { ParsedAuditFilters } from "./audit-log-parse";
import { AuditFilters, DetailsCell, PersonCell } from "./audit-log-parts";

const AuditLogView = async ({
  filters,
}: {
  readonly filters: ParsedAuditFilters;
}) => {
  const session = await getPageSession();
  if (session.kind !== "authenticated" || session.user.role !== "admin") {
    redirect("/");
  }
  const [events, locked] = await Promise.all([
    listAuditEvents({
      from: filters.from ? `${filters.from}T00:00:00.000Z` : undefined,
      limit: filters.limit ?? DEFAULT_LIMIT,
      query: filters.person,
      to: filters.to ? endOfDay(filters.to) : undefined,
      type: filters.type,
    }),
    listLockedAccounts({}),
  ]);
  return (
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
      {locked.ok ? (
        <LockedAccountsPanel accounts={locked.data} />
      ) : (
        <div className="panel panel-b" role="alert">
          Locked accounts could not be loaded. Refresh to retry.
        </div>
      )}
      <AuditFilters filters={filters} />
      {events.ok ? (
        <section aria-label="Audit events" className="panel clients-panel">
          {events.data.length ? (
            <section
              aria-label="Audit events table"
              className="audit-scroll"
              // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users need to scroll the wide table.
              tabIndex={0}
            >
              <table className="clients-table audit-table">
                <TableCaption className="sr-only">
                  Audit events, newest first
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Person</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.data.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="clients-nowrap">
                        <time
                          dateTime={entry.createdAt}
                          title={entry.createdAt}
                        >
                          {timeFormatter.format(new Date(entry.createdAt))}
                        </time>
                      </TableCell>
                      <TableCell>{auditEventLabel(entry.type)}</TableCell>
                      <TableCell>
                        <PersonCell entry={entry} />
                      </TableCell>
                      <TableCell>{entry.actorName ?? "—"}</TableCell>
                      <TableCell className="clients-nowrap">
                        {entry.ip ?? "—"}
                      </TableCell>
                      <TableCell title={entry.userAgent ?? undefined}>
                        {shortenUserAgent(entry.userAgent)}
                      </TableCell>
                      <TableCell>
                        <DetailsCell details={entry.details} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </table>
            </section>
          ) : (
            <p className="panel-b muted">
              No audit events match these filters.
            </p>
          )}
        </section>
      ) : (
        <div className="panel panel-b" role="alert">
          Audit events could not be loaded. Refresh to retry.
        </div>
      )}
    </div>
  );
};

export { AuditLogView };
