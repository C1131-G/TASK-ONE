/* eslint-disable shadcn/no-restyle, shadcn/no-unknown-classes -- Bug views use reference workspace CSS classes. */

"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { reassignClientBugAction } from "@/features/bugs/bugs-actions";
import {
  AskClientDialog,
  CloseNotABugDialog,
} from "@/features/bugs/components/bug-client-dialogs";
import { BugPickForm } from "@/features/bugs/components/bug-pick-form";

import { slaClockText } from "../bug-sla-format";
import { formatBugDate } from "../bug-workflow-ui-shared";
import type { BugHistory } from "../bug-workflow-ui-shared";

const CLOSED_STATUSES = new Set(["closed", "duplicate", "withdrawn"]);

const IMPACT_LABELS = {
  high: "High impact",
  low: "Low impact",
  medium: "Medium impact",
  urgent: "Urgent impact",
} as const;

const RESOLUTION_TEXT: Record<string, string> = {
  confirmed: "Client confirmed the fix",
  no_response: "Auto-closed: no response from the client",
  not_a_bug: "Closed as not a bug",
  unconfirmed: "Auto-closed: client did not verify within 7 days",
};

const DAY_MS = 86_400_000;
const MAX_CLIENT_REOPENS = 3;

const addDays = (value: string, days: number): string =>
  formatBugDate(
    new Date(new Date(value).getTime() + days * DAY_MS).toISOString()
  );

const waitingText = (
  status: string,
  report: NonNullable<BugHistory["clientReport"]>
): string | null => {
  if (status === "needs_info" && report.needsInfoSince) {
    return `Waiting for the client since ${formatBugDate(report.needsInfoSince)} (auto-closes ${addDays(report.needsInfoSince, 14)})`;
  }
  if (status === "awaiting_client" && report.awaitingClientSince) {
    return `Waiting for the client to verify since ${formatBugDate(report.awaitingClientSince)} (auto-closes ${addDays(report.awaitingClientSince, 7)})`;
  }
  return null;
};

const ClientOutcomeFacts = ({
  report,
  resolutionText,
}: {
  readonly report: NonNullable<BugHistory["clientReport"]>;
  readonly resolutionText: string | null;
}) => (
  <>
    {report.reopenCount > 0 ? (
      <div>
        <dt>Reopened by the client</dt>
        <dd>
          {report.reopenCount} of {MAX_CLIENT_REOPENS} times
          {report.reopenCount >= MAX_CLIENT_REOPENS ? " (now admin-only)" : ""}
        </dd>
      </div>
    ) : null}
    {report.satisfaction ? (
      <div>
        <dt>Client rating</dt>
        <dd>
          <span aria-hidden="true">
            {report.satisfaction === "up" ? "👍" : "👎"}
          </span>{" "}
          <span className="sr-only">
            {report.satisfaction === "up" ? "Thumbs up" : "Thumbs down"}
          </span>
          {report.satisfactionComment ? (
            <span className="muted"> “{report.satisfactionComment}”</span>
          ) : null}
        </dd>
      </div>
    ) : null}
    {resolutionText ? (
      <div>
        <dt>Closed</dt>
        <dd>{resolutionText}</dd>
      </div>
    ) : null}
  </>
);

const SlaFacts = ({
  sla,
}: {
  readonly sla: NonNullable<NonNullable<BugHistory["clientReport"]>["sla"]>;
}) => (
  <>
    {(
      [
        ["First response", sla.firstResponse],
        ["Resolution", sla.resolution],
      ] as const
    ).map(([label, clock]) => (
      <div key={label}>
        <dt>{label}</dt>
        <dd>
          <span className={`bug-sla-text bug-sla-${clock.state}`}>
            {slaClockText(clock)}
          </span>
        </dd>
      </div>
    ))}
  </>
);

const ReassignForm = ({
  employees,
  history,
}: {
  readonly employees: readonly { readonly id: string; readonly name: string }[];
  readonly history: BugHistory;
}) => {
  const router = useRouter();
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [employeeId, setEmployeeId] = useState("");
  const [message, setMessage] = useState<{
    readonly ok: boolean;
    readonly text: string;
  } | null>(null);
  const currentIds = new Set(history.assignees.map((person) => person.id));
  const options = employees.filter((employee) => !currentIds.has(employee.id));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!employeeId) {
      setMessage({ ok: false, text: "Choose an employee to reassign to." });
      return;
    }
    const name = options.find((employee) => employee.id === employeeId)?.name;
    startTransition(async () => {
      const result = await reassignClientBugAction({
        bugId: history.bug.id,
        employeeId,
        expectedVersion: history.bug.version,
      });
      if (result.ok) {
        setMessage({ ok: true, text: `Reassigned to ${name ?? "employee"}.` });
        setEmployeeId("");
        router.refresh();
        return;
      }
      setMessage({ ok: false, text: result.error.message });
    });
  };

  return (
    <form className="bug-inline-form bug-reassign-form" onSubmit={submit}>
      <div className="bug-form-field">
        <Label htmlFor={`${id}-employee`}>Reassign to</Label>
        <Select onValueChange={setEmployeeId} value={employeeId}>
          <SelectTrigger className="w-full" id={`${id}-employee`}>
            <SelectValue placeholder="Choose an employee" />
          </SelectTrigger>
          <SelectContent>
            {options.map((employee) => (
              <SelectItem key={employee.id} value={employee.id}>
                {employee.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {message?.ok === false ? (
        <p className="bug-form-error" role="alert">
          {message.text}
        </p>
      ) : null}
      {message?.ok ? (
        <output className="bug-client-success">{message.text}</output>
      ) : null}
      <Button disabled={pending || options.length === 0} type="submit">
        {pending ? "Reassigning…" : "Reassign"}
      </Button>
    </form>
  );
};

export const BugClientSection = ({
  employees,
  history,
  isAdmin,
}: {
  readonly employees: readonly { readonly id: string; readonly name: string }[];
  readonly history: BugHistory;
  readonly isAdmin: boolean;
}) => {
  const report = history.clientReport;
  if (!report) {
    return null;
  }
  const { bug } = history;
  const picked = bug.pickedById !== null;
  const waiting = waitingText(bug.status, report);
  const resolutionText =
    CLOSED_STATUSES.has(bug.status) && report.resolution
      ? (RESOLUTION_TEXT[report.resolution] ?? report.resolution)
      : null;
  const canReassign =
    isAdmin && !history.archived && picked && !CLOSED_STATUSES.has(bug.status);
  return (
    <section
      aria-labelledby="bug-client-heading"
      className="panel panel-b bug-detail-section bug-client-section"
    >
      <h2 id="bug-client-heading">Client report</h2>
      <dl className="bug-client-facts">
        <div>
          <dt>Company</dt>
          <dd>{report.companyName}</dd>
        </div>
        {bug.clientImpact ? (
          <div>
            <dt>Client impact</dt>
            <dd>
              <span
                className={`bug-impact-chip bug-impact-${bug.clientImpact}`}
              >
                {IMPACT_LABELS[bug.clientImpact]}
              </span>
            </dd>
          </div>
        ) : null}
        {report.sla ? <SlaFacts sla={report.sla} /> : null}
        <ClientOutcomeFacts report={report} resolutionText={resolutionText} />
      </dl>
      {bug.needsReassignment ? (
        <p className="bug-client-warning" role="alert">
          Needs reassignment — its handler is no longer available.
        </p>
      ) : null}
      {picked ? (
        <output className="bug-client-banner">
          Picked by {report.pickedByName ?? "a handler"}
          {report.pickedAt ? ` on ${formatBugDate(report.pickedAt)}` : ""}
        </output>
      ) : (
        <output className="bug-client-banner bug-client-waiting">
          Waiting for a handler to pick it up
        </output>
      )}
      {waiting ? (
        <output className="bug-client-banner bug-client-waiting">
          {waiting}
        </output>
      ) : null}
      {!history.archived && (report.canAskClient || report.canCloseNotABug) ? (
        <div className="bug-client-action">
          <h3>Client communication</h3>
          <div className="bug-client-buttons">
            {report.canAskClient ? (
              <AskClientDialog bugId={bug.id} version={bug.version} />
            ) : null}
            {report.canCloseNotABug ? (
              <CloseNotABugDialog bugId={bug.id} version={bug.version} />
            ) : null}
          </div>
        </div>
      ) : null}
      {report.canPick && !history.archived ? (
        <div className="bug-client-action">
          <h3>Pick this bug</h3>
          <p className="muted">
            Picking makes you the only assignee. Others can view but not act.
          </p>
          <BugPickForm
            bugId={bug.id}
            defaultSeverity={bug.severity}
            expectedVersion={bug.version}
          />
        </div>
      ) : null}
      {canReassign ? (
        <div className="bug-client-action">
          <h3>Reassign</h3>
          <ReassignForm employees={employees} history={history} />
        </div>
      ) : null}
    </section>
  );
};
