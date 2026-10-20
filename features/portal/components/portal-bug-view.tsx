/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  SKELETON_KEYS,
  SkeletonBone,
  SkeletonRows,
} from "@/components/workspace/skeleton-shapes";
import { SkelterSurface } from "@/components/workspace/skelter-surface";
import { clientStatusText } from "@/features/portal/client-status";
import { PortalAttachments } from "@/features/portal/components/portal-attachments";
import { PortalBugManage } from "@/features/portal/components/portal-bug-manage";
import { PortalComments } from "@/features/portal/components/portal-comments";
import { PortalLifecycleBanner } from "@/features/portal/components/portal-lifecycle";
import { PortalStatusChip } from "@/features/portal/components/portal-status-chip";
import { PortalTime } from "@/features/portal/components/portal-time";
import { hasLifecycleBanner } from "@/features/portal/lifecycle-state";
import { getPortalCompany } from "@/features/portal/portal-company";
import { impactText } from "@/features/portal/portal-format";
import {
  getPortalBugRecord,
  getPortalFilePreviewUrl,
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

const PortalResponseNotice = async ({ bugId }: { readonly bugId: string }) => {
  const bug = await getPortalBugRecord(bugId);
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
  responseNotice,
}: {
  readonly bug: PortalBugDetail;
  readonly isPreview: boolean;
  readonly responseNotice: ReactNode;
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
      {awaitingResponse ? responseNotice : null}
    </>
  );
};

const isImageAttachment = (
  attachment: PortalBugDetail["attachments"][number]
) => attachment.previewable && attachment.contentType.startsWith("image/");

// Image previews are signed with the page, keyed by file id; a failed signature
// reads as an unavailable preview.
const signImagePreviews = async (
  attachments: PortalBugDetail["attachments"]
): Promise<Readonly<Record<string, string | null>>> => {
  const images = attachments.filter(isImageAttachment);
  const results = await Promise.all(
    images.map(({ fileId }) => getPortalFilePreviewUrl(fileId))
  );
  return Object.fromEntries(
    images.map(({ fileId }, index) => {
      const result = results[index];
      return [fileId, result?.ok ? result.data : null];
    })
  );
};

// The page owns the response-notice boundary and hands it in as a slot; it
// shows only while the bug still awaits a first response.
const PortalBugView = async ({
  bugId,
  responseNotice,
}: {
  readonly bugId: string;
  readonly responseNotice: ReactNode;
}) => {
  const [record, company] = await Promise.all([
    getPortalBugRecord(bugId),
    getPortalCompany(),
  ]);
  const isPreview = Boolean(company?.preview);
  // Preview is read only: every capability the server reports is turned off
  // so no mutating control renders. The server refuses these actions anyway.
  const bug: PortalBugDetail = isPreview
    ? {
        ...record,
        canAttach: false,
        canComment: false,
        canEdit: false,
        canWithdraw: false,
        lifecycle: {
          ...record.lifecycle,
          canRate: false,
          canReportAgain: false,
        },
      }
    : record;
  const previewUrls = await signImagePreviews(bug.attachments);
  return (
    <div className="portal-detail">
      <Link
        className="portal-back"
        href="/portal"
        transitionTypes={["nav-back"]}
      >
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
      <PortalBugNotices
        bug={bug}
        isPreview={isPreview}
        responseNotice={responseNotice}
      />
      <div className="portal-detail-grid">
        <div className="portal-detail-main">
          <PortalBugManage bug={bug}>
            <BugSections bug={bug} />
          </PortalBugManage>
          <PortalAttachments
            attachments={bug.attachments}
            bugId={bug.id}
            canAttach={bug.canAttach}
            previewUrls={previewUrls}
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
  <SkelterSurface label="Loading bug">
    <div className="portal-detail">
      <div className="portal-back">
        <SkeletonBone shape="short" />
      </div>
      <div className="portal-bug-head skeleton-copy">
        <SkeletonBone shape="short" />
        <SkeletonBone shape="title" />
        <SkeletonBone />
      </div>
      <div className="portal-detail-grid">
        <div className="portal-detail-main">
          {SKELETON_KEYS.slice(0, 3).map((key) => (
            <div className="panel portal-panel" key={key}>
              <SkeletonBone shape="title" />
              <SkeletonRows rows={3} />
            </div>
          ))}
        </div>
        <div className="portal-detail-side">
          <div className="panel portal-panel">
            <SkeletonBone shape="title" />
            <SkeletonRows rows={4} />
          </div>
        </div>
      </div>
    </div>
  </SkelterSurface>
);

// Holds the notice's line while response times load.
const PortalResponseNoticeSkeleton = () => (
  <span
    aria-hidden="true"
    className="portal-notice portal-response-note portal-response-pending"
  />
);

export {
  PortalBugView,
  PortalBugViewSkeleton,
  PortalResponseNotice,
  PortalResponseNoticeSkeleton,
};
