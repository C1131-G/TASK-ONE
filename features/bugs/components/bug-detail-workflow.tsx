/* eslint-disable shadcn/no-unknown-classes -- Bug views use reference workspace CSS classes. */

"use client";

/* eslint-disable shadcn/no-restyle, shadcn/no-unknown-classes -- These workspace classes are defined in app/workspace-styles to match the reference UI. */

import { ArrowLeft } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  archiveBugAction,
  reopenBugAction,
  restoreBugAction,
} from "@/features/bugs/bugs-actions";
import type { addBugFixAttemptAction } from "@/features/bugs/bugs-actions";
import { BugApprovalReleaseSection } from "@/features/bugs/components/bug-approval-release-section";
import { BugDiscoverySection } from "@/features/bugs/components/bug-discovery-section";
import { BugEvidenceSection } from "@/features/bugs/components/bug-evidence-section";
import { BugInvestigationSection } from "@/features/bugs/components/bug-investigation-section";
import { BugRelatedHistorySection } from "@/features/bugs/components/bug-related-history-section";
import { BugSubmissionSection } from "@/features/bugs/components/bug-submission-section";
import { BugTriageSection } from "@/features/bugs/components/bug-triage-section";
import { BugVerificationSection } from "@/features/bugs/components/bug-verification-section";
import {
  getFileDownloadUrlAction,
  getFilePreviewUrlAction,
} from "@/features/files/files-actions";
import type { BugHistorySchema } from "@/src/server/work/bug-history";

type BugHistory = typeof BugHistorySchema.Type;
type BugActionResult = Awaited<ReturnType<typeof addBugFixAttemptAction>>;

const statusLabels: Record<BugHistory["bug"]["status"], string> = {
  approved_for_release: "Approved for release",
  awaiting_admin_approval: "Awaiting admin approval",
  awaiting_client: "Awaiting client",
  closed: "Closed",
  duplicate: "Duplicate",
  in_progress: "In progress",
  in_verification: "In verification",
  needs_info: "Needs info",
  rejected: "Changes requested",
  released: "Released",
  reported: "Reported",
  triaged: "Triaged",
  withdrawn: "Withdrawn",
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const formatDate = (value: string): string =>
  dateFormatter.format(new Date(value));

export const BugDetailWorkflow = ({
  embedded = false,
  employees,
  history,
  isAdmin,
  userId,
}: {
  readonly embedded?: boolean;
  readonly employees: readonly { readonly id: string; readonly name: string }[];
  readonly history: BugHistory;
  readonly isAdmin: boolean;
  readonly userId: string;
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const canEdit =
    isAdmin ||
    history.bug.reporterId === userId ||
    history.assignees.some(({ id }) => id === userId);
  const latestAttempt = history.attempts.at(-1) ?? null;
  const isReadOnly =
    history.archived ||
    [
      "closed",
      "duplicate",
      "awaiting_admin_approval",
      "approved_for_release",
      "released",
    ].includes(history.bug.status);

  const finishAction = (result: BugActionResult) => {
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setError(null);
    router.refresh();
  };

  const submit = (
    event: FormEvent<HTMLFormElement>,
    run: (formData: FormData) => Promise<BugActionResult>
  ) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => finishAction(await run(formData)));
  };

  const runAction = (action: Promise<BugActionResult>) =>
    startTransition(async () => finishAction(await action));

  const openFile = async (fileId: string, preview: boolean) => {
    const result = preview
      ? await getFilePreviewUrlAction({ fileId })
      : await getFileDownloadUrlAction({ fileId });
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    window.open(result.data, "_blank", "noopener,noreferrer");
  };

  return (
    <article
      className={`page bug-detail-page${embedded ? " bug-detail-embedded" : ""}`}
    >
      {embedded ? null : (
        <Link
          className="bug-back-link"
          href="/bugs"
          transitionTypes={["nav-back"]}
        >
          <ArrowLeft aria-hidden="true" size={15} /> Bugs
        </Link>
      )}
      <header className="bug-detail-header">
        <div className="bug-detail-heading">
          <p className="eyebrow">
            {history.bug.projectKey}-{history.bug.projectTaskNumber} ·{" "}
            {history.bug.component}
          </p>
          <h1>{history.bug.title}</h1>
          <p className="muted">
            Found at {history.bug.route} · {history.bug.environment} ·{" "}
            {formatDate(history.bug.discoveredAt)}
          </p>
        </div>
        <div className="bug-detail-header-actions">
          {history.bug.clientCompanyId ? (
            <span className="bug-client-badge">Client report</span>
          ) : null}
          <span
            className={`bug-workflow-status bug-status-${history.bug.status}`}
          >
            {statusLabels[history.bug.status]}
          </span>
          {isAdmin && history.archived ? (
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () =>
                  finishAction(
                    await restoreBugAction({
                      bugId: history.bug.id,
                      expectedVersion: history.bug.version,
                    })
                  )
                )
              }
              variant="outline"
            >
              Restore
            </Button>
          ) : null}
          {isAdmin && !history.archived && history.bug.status === "closed" ? (
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () =>
                  finishAction(
                    await reopenBugAction({
                      bugId: history.bug.id,
                      expectedVersion: history.bug.version,
                    })
                  )
                )
              }
              variant="outline"
            >
              Reopen
            </Button>
          ) : null}
          {isAdmin && !history.archived ? (
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () =>
                  finishAction(
                    await archiveBugAction({
                      bugId: history.bug.id,
                      expectedVersion: history.bug.version,
                    })
                  )
                )
              }
              variant="outline"
            >
              Archive
            </Button>
          ) : null}
        </div>
      </header>
      {error ? (
        <p className="bug-form-error" role="alert">
          {error}
        </p>
      ) : null}
      {history.archived ? (
        <output className="bug-read-only-note">
          Archived bugs are read only.
        </output>
      ) : null}

      <BugDiscoverySection history={history} />
      <BugTriageSection
        employees={employees}
        history={history}
        isAdmin={isAdmin}
        pending={pending}
        submit={submit}
      />
      <BugInvestigationSection
        canEdit={canEdit}
        history={history}
        isReadOnly={isReadOnly}
        pending={pending}
        submit={submit}
      />
      <BugEvidenceSection
        canEdit={canEdit}
        history={history}
        isReadOnly={isReadOnly}
        latestAttempt={latestAttempt}
        onError={setError}
        openFile={openFile}
        pending={pending}
        submit={submit}
      />
      <BugVerificationSection
        canEdit={canEdit}
        history={history}
        isReadOnly={isReadOnly}
        latestAttempt={latestAttempt}
        pending={pending}
        submit={submit}
      />
      <BugSubmissionSection
        canEdit={canEdit}
        history={history}
        isReadOnly={isReadOnly}
        latestAttempt={latestAttempt}
        pending={pending}
        runAction={runAction}
      />
      <BugApprovalReleaseSection
        history={history}
        isAdmin={isAdmin}
        pending={pending}
        runAction={runAction}
        submit={submit}
      />
      <BugRelatedHistorySection
        canEdit={canEdit}
        history={history}
        isReadOnly={isReadOnly}
        submit={submit}
      />
    </article>
  );
};
