/* eslint-disable shadcn/no-unknown-classes, shadcn/no-restyle -- Workspace classes are defined in app/workspace-styles. */

import Link from "next/link";

import {
  auditEventLabels,
  auditEventTypes,
} from "@/features/clients/audit-event-types";

import type { AuditEntry, parseFilters } from "./audit-log-parse";
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  attemptedEmail,
  detailPairs,
} from "./audit-log-parse";

export const PersonCell = ({ entry }: { readonly entry: AuditEntry }) => {
  if (entry.subjectName || entry.subjectEmail) {
    return (
      <span className="clients-person">
        <strong>{entry.subjectName ?? entry.subjectEmail}</strong>
        {entry.subjectName && entry.subjectEmail ? (
          <span>{entry.subjectEmail}</span>
        ) : null}
      </span>
    );
  }
  const attempted = attemptedEmail(entry.details);
  return (
    <span className="clients-person">
      <strong>Unknown account</strong>
      {attempted ? <span>{attempted}</span> : null}
    </span>
  );
};

export const DetailsCell = ({ details }: { readonly details: unknown }) => {
  const pairs = detailPairs(details);
  if (!pairs.length) {
    return <span className="muted">—</span>;
  }
  return (
    <dl className="audit-details">
      {pairs.map(([key, value]) => (
        <div key={key}>
          <dt>{key}:</dt> <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
};

export const AuditFilters = ({
  filters,
}: {
  readonly filters: ReturnType<typeof parseFilters>;
}) => (
  <form
    action="/clients/audit"
    aria-label="Filter audit events"
    className="panel panel-b audit-filters"
    method="get"
  >
    <label className="field" htmlFor="audit-type">
      <span>Event</span>
      <select
        className="input"
        defaultValue={filters.type ?? ""}
        id="audit-type"
        name="type"
      >
        <option value="">All events</option>
        {auditEventTypes.map((type) => (
          <option key={type} value={type}>
            {auditEventLabels[type]}
          </option>
        ))}
      </select>
    </label>
    <label className="field" htmlFor="audit-person">
      <span>Person</span>
      <input
        className="input"
        defaultValue={filters.person ?? ""}
        id="audit-person"
        maxLength={120}
        name="q"
        placeholder="Name or email"
        type="search"
      />
    </label>
    <label className="field" htmlFor="audit-from">
      <span>From</span>
      <input
        className="input"
        defaultValue={filters.from ?? ""}
        id="audit-from"
        name="from"
        type="date"
      />
    </label>
    <label className="field" htmlFor="audit-to">
      <span>To</span>
      <input
        className="input"
        defaultValue={filters.to ?? ""}
        id="audit-to"
        name="to"
        type="date"
      />
    </label>
    <label className="field" htmlFor="audit-limit">
      <span>Max rows</span>
      <input
        className="input"
        defaultValue={filters.limit ?? DEFAULT_LIMIT}
        id="audit-limit"
        max={MAX_LIMIT}
        min={1}
        name="limit"
        type="number"
      />
    </label>
    <div className="acts audit-filter-actions">
      <button className="btn btn-primary btn-sm" type="submit">
        Apply filters
      </button>
      <Link className="btn btn-ghost btn-sm" href="/clients/audit">
        Reset
      </Link>
    </div>
  </form>
);
