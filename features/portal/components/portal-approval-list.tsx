/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import {
  SKELETON_KEYS,
  SkeletonBone,
} from "@/components/workspace/skeleton-shapes";
import { SkelterSurface } from "@/components/workspace/skelter-surface";
import { PortalTime } from "@/features/portal/components/portal-time";
import {
  approvalStatusText,
  approvalStatusTone,
} from "@/features/portal/portal-approval-format";
import { listPortalApprovals } from "@/features/portal/portal-approval-queries";
import { readOrThrow } from "@/lib/read-result";

const PortalApprovalList = async () => {
  const approvals = readOrThrow(await listPortalApprovals({}), "Approvals");
  if (approvals.length === 0) {
    return (
      <div className="panel empty-state">
        <span aria-hidden="true" className="glyph">
          <CheckCircle size={22} />
        </span>
        <h2 className="es-h">Nothing to approve</h2>
        <p>
          When the team asks you to review a deliverable, it shows up here with
          its files.
        </p>
      </div>
    );
  }
  return (
    <ul aria-label="Approvals" className="portal-bug-list">
      {approvals.map((approval) => (
        <li key={approval.id}>
          <Link
            className="portal-bug-card"
            href={`/portal/approvals/${approval.id}`}
            transitionTypes={["nav-forward"]}
          >
            <span className="portal-bug-top">
              <span className="portal-bug-key">{approval.projectName}</span>
              <span className={`badge ${approvalStatusTone[approval.status]}`}>
                <span aria-hidden="true" className="dot" />
                {approvalStatusText[approval.status]}
              </span>
            </span>
            <strong className="portal-bug-title">
              {approval.subjectTitle}
            </strong>
            <span className="portal-bug-meta">
              <span>Version {approval.version}</span>
              <span>
                {approval.fileCount === 1
                  ? "1 file"
                  : `${approval.fileCount} files`}
              </span>
              <span>
                Requested <PortalTime iso={approval.requestedAt} />
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
};

const PortalApprovalListSkeleton = () => (
  <SkelterSurface label="Loading approvals">
    <ul className="portal-bug-list">
      {SKELETON_KEYS.slice(0, 3).map((key) => (
        <li key={key}>
          <div className="portal-bug-card">
            <div className="portal-bug-top">
              <SkeletonBone shape="short" />
              <SkeletonBone shape="short" />
            </div>
            <SkeletonBone shape="title" />
            <div className="portal-bug-meta">
              <SkeletonBone />
              <SkeletonBone shape="short" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  </SkelterSurface>
);

export { PortalApprovalList, PortalApprovalListSkeleton };
