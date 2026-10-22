/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import {
  SKELETON_KEYS,
  SkeletonBone,
} from "@/components/workspace/skeleton-shapes";
import { SkelterSurface } from "@/components/workspace/skelter-surface";
import { PortalApprovalDecision } from "@/features/portal/components/portal-approval-decision";
import { PortalApprovalFiles } from "@/features/portal/components/portal-approval-files";
import { PortalTime } from "@/features/portal/components/portal-time";
import {
  approvalStatusText,
  approvalStatusTone,
} from "@/features/portal/portal-approval-format";
import { getPortalApprovalRecord } from "@/features/portal/portal-approval-queries";

// A client sees the request message, exactly the files attached to it, the
// decision and the earlier versions of the same deliverable. Nothing else
// about the task is shown.
const PortalApprovalView = async ({
  approvalId,
}: {
  readonly approvalId: string;
}) => {
  const approval = await getPortalApprovalRecord(approvalId);
  return (
    <div className="portal-detail">
      <Link
        className="portal-back"
        href="/portal/approvals"
        transitionTypes={["nav-back"]}
      >
        <ArrowLeft aria-hidden="true" size={14} />
        All approvals
      </Link>
      <header className="portal-bug-head">
        <span className="portal-bug-top">
          <span className="portal-bug-key">
            {approval.projectName} · Version {approval.version}
          </span>
          <span className={`badge ${approvalStatusTone[approval.status]}`}>
            <span aria-hidden="true" className="dot" />
            {approvalStatusText[approval.status]}
          </span>
        </span>
        <h1>{approval.subjectTitle}</h1>
        <p className="faint">
          Requested by {approval.requestedByName}{" "}
          <PortalTime iso={approval.requestedAt} />
        </p>
        <p className="portal-prose">{approval.message}</p>
      </header>
      <section aria-labelledby="portal-files-h" className="panel portal-panel">
        <h2 className="sec" id="portal-files-h">
          Files to review
        </h2>
        <PortalApprovalFiles files={approval.files} />
      </section>
      {approval.canDecide ? (
        <PortalApprovalDecision requestId={approval.id} />
      ) : (
        <section
          aria-labelledby="portal-outcome-h"
          className="panel portal-panel"
        >
          <h2 className="sec" id="portal-outcome-h">
            Outcome
          </h2>
          <p>
            {approvalStatusText[approval.status]}
            {approval.decidedByName ? ` by ${approval.decidedByName}` : ""}
            {approval.decidedAt ? (
              <>
                {" "}
                <PortalTime iso={approval.decidedAt} />
              </>
            ) : null}
          </p>
          {approval.decisionComment ? (
            <p className="portal-prose">{approval.decisionComment}</p>
          ) : null}
        </section>
      )}
      {approval.history.length > 0 ? (
        <section
          aria-labelledby="portal-history-h"
          className="panel portal-panel"
        >
          <h2 className="sec" id="portal-history-h">
            Earlier versions
          </h2>
          <ol className="portal-comments">
            {approval.history.map((version) => (
              <li className="portal-comment" key={version.id}>
                <p className="portal-comment-head">
                  <strong>Version {version.version}</strong>
                  <span
                    className={`badge ${approvalStatusTone[version.status]}`}
                  >
                    {approvalStatusText[version.status]}
                  </span>
                  {version.decidedAt ? (
                    <span className="faint">
                      <PortalTime iso={version.decidedAt} />
                    </span>
                  ) : null}
                </p>
                {version.decisionComment ? (
                  <p className="portal-comment-body">
                    {version.decisionComment}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
};

const PortalApprovalViewSkeleton = () => (
  <SkelterSurface label="Loading approval">
    <div className="portal-detail">
      <SkeletonBone shape="short" />
      <SkeletonBone shape="title" />
      {SKELETON_KEYS.slice(0, 2).map((key) => (
        <SkeletonBone key={key} />
      ))}
    </div>
  </SkelterSurface>
);

export { PortalApprovalView, PortalApprovalViewSkeleton };
