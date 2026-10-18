/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { clientStatusText } from "@/features/portal/client-status";
import { PortalAttachments } from "@/features/portal/components/portal-attachments";
import { PortalBugManage } from "@/features/portal/components/portal-bug-manage";
import { PortalComments } from "@/features/portal/components/portal-comments";
import { PortalLifecycleBanner } from "@/features/portal/components/portal-lifecycle";
import { PortalDetailSkeleton } from "@/features/portal/components/portal-skeletons";
import { PortalStatusChip } from "@/features/portal/components/portal-status-chip";
import { PortalTime } from "@/features/portal/components/portal-time";
import { hasLifecycleBanner } from "@/features/portal/lifecycle-state";
import { getPortalCompany } from "@/features/portal/portal-company";
import { impactText } from "@/features/portal/portal-format";
import {
  getPortalBug,
  getPortalResponseTimes,
} from "@/features/portal/portal-queries";
import { usuallyRespondText } from "@/features/portal/portal-response-time";
import type { PortalBugDetail } from "@/src/server/portal/portal-contracts";

const isHttpUrl = (value: string) => {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};

const readOnlyMessage = (bug: PortalBugDetail) => {
  if (bug.status === "withdrawn") {
    return "This bug was withdrawn. It can no longer be edited.";
  }
  if (bug.canComment) {
    return "This bug can no longer be edited because the team has started on it. You can still add comments and attachments.";
  }
  return "This bug is closed and read-only. You can still read everything about it.";
};

const BugSections = ({ bug }: { readonly bug: PortalBugDetail }) => {
  const environment = [
    ["Browser", bug.browser],
    ["Device", bug.device],
    ["Operating system", bug.os],
  ] as const;
  return (
    <>
      {bug.description ? (
        <section aria-labelledby="portal-desc-h" className="panel portal-panel">
          <h2 className="sec" id="portal-desc-h">
            Description
          </h2>
          <p className="portal-prose">{bug.description}</p>
        </section>
      ) : null}
      <section aria-labelledby="portal-steps-h" className="panel portal-panel">
        <h2 className="sec" id="portal-steps-h">
          Steps to reproduce
        </h2>
        <ol className="portal-step-list">
          {bug.reproductionSteps.map((step, index) => (
            // Steps are plain text in a fixed order, so position identifies one.
            // eslint-disable-next-line react/no-array-index-key
            <li key={`${index}-${step}`}>{step}</li>
          ))}
        </ol>
      </section>
      <section
        aria-labelledby="portal-behavior-h"
        className="panel portal-panel"
      >
        <h2 className="sec" id="portal-behavior-h">
          Expected and actual behavior
        </h2>
        <div className="portal-two">
          <div>
            <h3 className="sub">Expected</h3>
            <p className="portal-prose">{bug.expectedBehavior}</p>
          </div>
          <div>
            <h3 className="sub">Actual</h3>
            <p className="portal-prose">{bug.actualBehavior}</p>
          </div>
        </div>
      </section>
      <section aria-labelledby="portal-where-h" className="panel portal-panel">
        <h2 className="sec" id="portal-where-h">
          Where it happened
        </h2>
        <dl className="portal-facts">
          <div>
            <dt>Page URL</dt>
            <dd>
              {isHttpUrl(bug.pageUrl) ? (
                <a
                  className="portal-link"
                  href={bug.pageUrl}
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  {bug.pageUrl}
                </a>
              ) : (
                bug.pageUrl
              )}
            </dd>
          </div>
          {environment.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value || "Not provided"}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
};

const PortalResponseNotice = async ({
  bug,
}: {
  readonly bug: PortalBugDetail;
}) => {
  if (bug.firstResponse.targetMinutes === null) {
    return null;
  }
  const times = await getPortalResponseTimes({});
  if (!times.ok) {
    return null;
  }
  return (
    <output className="portal-notice portal-response-note">
      {usuallyRespondText(bug.firstResponse.targetMinutes, times.data)}
    </output>
  );
};

const PortalBugNotices = ({
  bug,
  isPreview,
}: {
  readonly bug: PortalBugDetail;
  readonly isPreview: boolean;
}) => {
  const showReadOnlyNotice =
    !bug.canEdit &&
    !isPreview &&
    !bug.readOnlyReason &&
    !hasLifecycleBanner(bug);
  const awaitingResponse =
    (bug.status === "submitted" || bug.status === "acknowledged") &&
    bug.firstResponse.respondedAt === null &&
    bug.firstResponse.targetMinutes !== null;
  return (
    <>
      {bug.readOnlyReason && !isPreview ? (
        <p className="portal-banner" role="note">
          {bug.readOnlyReason}
        </p>
      ) : null}
      {showReadOnlyNotice ? (
        <p className="portal-banner" role="note">
          {readOnlyMessage(bug)}
        </p>
      ) : null}
      {isPreview ? (
        <p className="portal-banner" role="note">
          Editing, comments, attachments and replies are disabled in preview.
        </p>
      ) : null}
      <PortalLifecycleBanner bug={bug} isPreview={isPreview} />
      {awaitingResponse ? (
        <SectionErrorBoundary title="Response-time guidance is unavailable">
          <Suspense
            fallback={
              <span
                aria-hidden="true"
                className="portal-notice portal-response-note portal-response-pending"
              />
            }
          >
            <PortalResponseNotice bug={bug} />
          </Suspense>
        </SectionErrorBoundary>
      ) : null}
    </>
  );
};

const PortalBugView = async ({ bugId }: { readonly bugId: string }) => {
  const [result, company] = await Promise.all([
    getPortalBug({ bugId }),
    getPortalCompany(),
  ]);
  const isPreview = Boolean(company?.preview);
  if (!result.ok) {
    if (
      ["NOT_FOUND", "FORBIDDEN", "VALIDATION_FAILED"].includes(
        result.error.code
      )
    ) {
      notFound();
    }
    return (
      <div className="panel portal-alert" role="alert">
        This bug could not be loaded. Refresh to try again.
      </div>
    );
  }
  // Preview is read only: every capability the server reports is turned off
  // so no mutating control renders. The server refuses these actions anyway.
  const bug: PortalBugDetail = isPreview
    ? {
        ...result.data,
        canAttach: false,
        canComment: false,
        canEdit: false,
        canWithdraw: false,
        lifecycle: {
          ...result.data.lifecycle,
          canRate: false,
          canReportAgain: false,
        },
      }
    : result.data;
  return (
    <div className="portal-detail">
      <Link className="portal-back" href="/portal">
        <ArrowLeft aria-hidden="true" size={14} />
        Company bugs
      </Link>
      <header className="portal-bug-head">
        <p className="portal-bug-key">{bug.key}</p>
        <h1>{bug.title}</h1>
        <div className="portal-bug-meta">
          <PortalStatusChip status={bug.status} />
          <span>{bug.projectName}</span>
          {bug.impact ? <span>Impact: {impactText[bug.impact]}</span> : null}
          <span>
            Reported by {bug.isMine ? "you" : bug.reporterName} on{" "}
            <PortalTime iso={bug.createdAt} variant="date" />
          </span>
          <span>
            Updated <PortalTime iso={bug.updatedAt} />
          </span>
        </div>
      </header>
      <PortalBugNotices bug={bug} isPreview={isPreview} />
      <div className="portal-detail-grid">
        <div className="portal-detail-main">
          <PortalBugManage bug={bug}>
            <BugSections bug={bug} />
          </PortalBugManage>
          <PortalAttachments
            attachments={bug.attachments}
            bugId={bug.id}
            canAttach={bug.canAttach}
          />
          <PortalComments
            bugId={bug.id}
            canComment={bug.canComment}
            comments={bug.comments}
          />
        </div>
        <aside aria-label="Status history" className="portal-detail-side">
          <section className="panel portal-panel">
            <h2 className="sec">Status timeline</h2>
            <ol className="portal-timeline">
              {bug.timeline.map((entry) => (
                <li key={`${entry.status}-${entry.at}`}>
                  <strong>{clientStatusText[entry.status]}</strong>
                  <span className="faint">
                    <PortalTime iso={entry.at} />
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
};

const PortalBugViewSkeleton = () => <PortalDetailSkeleton />;

export { PortalBugView, PortalBugViewSkeleton };
