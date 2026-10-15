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
import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
import {
  auditEventLabel,
  auditEventLabels,
  auditEventTypes,
  isAuditEventType,
} from "@/features/clients/audit-event-types";
import {
  listAuditEvents,
  listLockedAccounts,
} from "@/features/clients/clients-queries";
import { LockedAccountsPanel } from "@/features/clients/components/locked-accounts-panel";
import { getPageSession } from "@/src/server/auth/page-session";

type SearchParams = Record<string, string | string[] | undefined>;

interface AuditEntry {
  readonly actorName: string | null;
  readonly createdAt: string;
  readonly details: unknown;
  readonly id: string;
  readonly ip: string | null;
  readonly subjectEmail: string | null;
  readonly subjectName: string | null;
  readonly type: string;
  readonly userAgent: string | null;
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const SECRET_KEY = /pass|secret|token|hash|key|cookie|authorization|session/iu;
const MAX_VALUE_LENGTH = 80;

const single = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value)?.trim() ?? "";

const validDate = (value: string): string | undefined =>
  DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    ? value
    : undefined;

const parseFilters = (params: SearchParams) => {
  const type = single(params.type);
  const person = single(params.q).slice(0, 120);
  const from = validDate(single(params.from));
  const to = validDate(single(params.to));
  const limitNumber = Number(single(params.limit));
  const limit =
    Number.isInteger(limitNumber) &&
    limitNumber >= 1 &&
    limitNumber <= MAX_LIMIT
      ? limitNumber
      : undefined;
  return {
    from,
    limit,
    person: person || undefined,
    to,
    type: isAuditEventType(type) ? type : undefined,
  };
};

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "medium",
});

const shortenUserAgent = (userAgent: string | null): string => {
  if (!userAgent) {
    return "—";
  }
  const browser = /(?:Edg|OPR|Firefox|Chrome|CriOS|FxiOS|Safari)\/[\d.]+/u.exec(
    userAgent
  )?.[0];
  const system = /\([^;)]+/u.exec(userAgent)?.[0].slice(1);
  const parts = [browser?.replace(/^Edg\//u, "Edge/"), system].filter(Boolean);
  return parts.length ? parts.join(" · ") : userAgent.slice(0, 40);
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const detailPairs = (
  details: unknown
): readonly (readonly [string, string])[] => {
  if (!isPlainObject(details)) {
    return [];
  }
  const pairs: (readonly [string, string])[] = [];
  for (const [key, value] of Object.entries(details)) {
    if (SECRET_KEY.test(key) || key === "email") {
      continue;
    }
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      const text = String(value);
      pairs.push([
        key.replaceAll("_", " "),
        text.length > MAX_VALUE_LENGTH
          ? `${text.slice(0, MAX_VALUE_LENGTH)}…`
          : text,
      ]);
    }
  }
  return pairs;
};

const attemptedEmail = (details: unknown): string | null =>
  isPlainObject(details) && typeof details.email === "string"
    ? details.email.slice(0, 254)
    : null;

const PersonCell = ({ entry }: { readonly entry: AuditEntry }) => {
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

const DetailsCell = ({ details }: { readonly details: unknown }) => {
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

const AuditFilters = ({
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

// A "to" date covers the whole day, so it filters up to the next midnight.
const endOfDay = (date: string): string =>
  new Date(
    Date.parse(`${date}T00:00:00Z`) + 24 * 60 * 60 * 1000 - 1
  ).toISOString();

const AuditLogView = async ({
  searchParams,
}: {
  readonly searchParams: Promise<SearchParams>;
}) => {
  const session = await getPageSession();
  if (session.kind !== "authenticated" || session.user.role !== "admin") {
    redirect("/");
  }
  const filters = parseFilters(await searchParams);
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

const AuditLogSkeleton = () => (
  <>
    <div className="ph">
      <div>
        <h1>Audit log</h1>
        <p className="muted">Loading audit events…</p>
      </div>
    </div>
    <PanelSkeleton label="Loading audit events…" rows={6} />
  </>
);

export { AuditLogSkeleton, AuditLogView };
