/* eslint-disable shadcn/no-unknown-classes */

import { LocalTime } from "@/components/workspace/local-time";
import { listProjectApprovals } from "@/features/approvals/approval-queries";
import { APPROVAL_STATUS_BADGES } from "@/features/approvals/approval-status";
import { ProjectApprovalForm } from "@/features/approvals/components/project-approval-form";
import { readOrThrow } from "@/lib/read-result";
import type { ProjectApprovals as ProjectApprovalsData } from "@/src/server/approvals/approval-contracts";

type Request = ProjectApprovalsData["requests"][number];

const decisionOf = (request: Request) => {
  if (request.status === "cancelled") {
    return request.cancelledAt ? (
      <>
        Withdrawn <LocalTime value={request.cancelledAt} />
      </>
    ) : (
      "Withdrawn"
    );
  }
  if (!request.decidedAt) {
    return "Waiting";
  }
  const verdict =
    request.status === "approved" ? "Approved" : "Changes requested";
  return (
    <>
      {verdict} by {request.decidedByName ?? "a client"} on{" "}
      <LocalTime value={request.decidedAt} />
      {request.decisionComment ? `: ${request.decisionComment}` : ""}
    </>
  );
};

const RequestRow = ({ request }: { readonly request: Request }) => {
  const badge = APPROVAL_STATUS_BADGES[request.status];
  return (
    <tr data-approval-version={request.version}>
      <th scope="row">
        {request.subjectTitle}
        <span className="muted">
          {" "}
          ({request.subjectKind === "task" ? "Task" : "Milestone"})
        </span>
      </th>
      <td>Version {request.version}</td>
      <td>{request.companyName}</td>
      <td>
        <span className={`badge ${badge.tone}`}>{badge.label}</span>
      </td>
      <td>
        {request.requestedByName} on <LocalTime value={request.requestedAt} />
      </td>
      <td className="muted">{decisionOf(request)}</td>
    </tr>
  );
};

// The Approvals view: a read-only list of every request for the project's
// tasks and milestones, and for administrators the milestone request form.
export const ProjectApprovals = async ({
  projectId,
}: {
  readonly projectId: string;
}) => {
  const approvals = readOrThrow(
    await listProjectApprovals({ projectId }),
    "Approvals"
  );
  return (
    <div className="stack" data-project-approvals="true">
      <section aria-labelledby="project-approvals-heading" className="panel">
        <div className="panel-h">
          <h2 id="project-approvals-heading">Client approvals</h2>
        </div>
        <div className="panel-b">
          {approvals.requests.length === 0 ? (
            <p className="muted">No approvals have been requested yet.</p>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <caption className="sr-only">
                  Approval requests for this project
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Work</th>
                    <th scope="col">Version</th>
                    <th scope="col">Company</th>
                    <th scope="col">Status</th>
                    <th scope="col">Requested by</th>
                    <th scope="col">Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {approvals.requests.map((request) => (
                    <RequestRow key={request.id} request={request} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
      {approvals.canRequest ? (
        <section aria-labelledby="milestone-approval-heading" className="panel">
          <div className="panel-h">
            <h2 id="milestone-approval-heading">Request milestone approval</h2>
          </div>
          <div className="panel-b">
            <ProjectApprovalForm
              choices={{
                companies: approvals.companies,
                files: approvals.files,
                milestones: approvals.milestones,
              }}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
};

export const ProjectApprovalsSkeleton = () => (
  <div aria-hidden="true" className="stack">
    <section className="panel">
      <div className="panel-h">
        <h2>Client approvals</h2>
      </div>
      <div className="panel-b" />
    </section>
  </div>
);
