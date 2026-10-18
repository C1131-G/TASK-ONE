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

import { formatBugDate } from "../bug-workflow-ui-shared";
import type { BugHistory } from "../bug-workflow-ui-shared";
import { ClientOutcomeFacts, SlaFacts } from "./bug-client-facts";
import {
  CLOSED_STATUSES,
  IMPACT_LABELS,
  RESOLUTION_TEXT,
  waitingText,
} from "./bug-client-labels";

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

const ClientReportStatus = ({
  bug,
  picked,
  report,
  waiting,
}: {
  readonly bug: BugHistory["bug"];
  readonly picked: boolean;
  readonly report: NonNullable<BugHistory["clientReport"]>;
  readonly waiting: string | null;
}) => (
  <>
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
  </>
);

const ClientReportActions = ({
  bug,
  canReassign,
  employees,
  history,
  report,
}: {
  readonly bug: BugHistory["bug"];
  readonly canReassign: boolean;
  readonly employees: readonly { readonly id: string; readonly name: string }[];
  readonly history: BugHistory;
  readonly report: NonNullable<BugHistory["clientReport"]>;
}) => (
  <>
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
  </>
);

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
      <ClientReportStatus
        bug={bug}
        report={report}
        picked={picked}
        waiting={waiting}
      />
      <ClientReportActions
        bug={bug}
        canReassign={canReassign}
        employees={employees}
        history={history}
        report={report}
      />
    </section>
  );
};
