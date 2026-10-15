/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";

import { clientStatusText } from "@/features/portal/client-status";
import { PortalAttachments } from "@/features/portal/components/portal-attachments";
import { PortalBugManage } from "@/features/portal/components/portal-bug-manage";
import { PortalComments } from "@/features/portal/components/portal-comments";
import { PortalLifecycleBanner } from "@/features/portal/components/portal-lifecycle";
import { PortalStatusChip } from "@/features/portal/components/portal-status-chip";
import { PortalTime } from "@/features/portal/components/portal-time";
import { hasLifecycleBanner } from "@/features/portal/lifecycle-state";
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

const PortalBugView = async ({ bugId }: { readonly bugId: string }) => {
  const result = await getPortalBug({ bugId });
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
  const bug = result.data;
  const readOnly = !bug.canEdit;
  const awaitingResponse =
    (bug.status === "submitted" || bug.status === "acknowledged") &&
    bug.firstResponse.respondedAt === null &&
    bug.firstResponse.targetMinutes !== null;
  const times = awaitingResponse ? await getPortalResponseTimes({}) : null;
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
      {awaitingResponse &&
      times?.ok &&
      bug.firstResponse.targetMinutes !== null ? (
        <output className="portal-notice portal-response-note">
          {usuallyRespondText(bug.firstResponse.targetMinutes, times.data)}
        </output>
      ) : null}
      <PortalLifecycleBanner bug={bug} />
      {readOnly && !hasLifecycleBanner(bug) ? (
        <p className="portal-banner" role="note">
          {readOnlyMessage(bug)}
        </p>
      ) : null}
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

const PortalBugViewSkeleton = () => (
  <div aria-busy="true" className="portal-detail">
    <output className="sr-only">Loading bug</output>
    <span aria-hidden="true" className="sk portal-sk-title" />
    <span aria-hidden="true" className="sk portal-sk-block" />
    <span aria-hidden="true" className="sk portal-sk-block" />
  </div>
);

export { PortalBugView, PortalBugViewSkeleton };
