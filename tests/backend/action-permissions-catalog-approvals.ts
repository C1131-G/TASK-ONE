import { entry } from "./action-permissions-shared";
import type { ActionEntry } from "./action-permissions-shared";
import { ids, nextKey } from "./support/action-harness";

const approvalActions =
  await import("../../features/approvals/approval-actions");
const approvalQueries =
  await import("../../features/approvals/approval-queries");

// Requesting and withdrawing approvals is staff work; clients answer through
// the portal actions, which the portal access test covers.
export const approvalActionCatalog: readonly ActionEntry[] = [
  entry("listTaskApprovals", approvalQueries.listTaskApprovals, () => ({
    taskId: ids.taskId,
  })),
  entry("listProjectApprovals", approvalQueries.listProjectApprovals, () => ({
    projectId: ids.projectId,
  })),
  entry("requestApprovalAction", approvalActions.requestApprovalAction, () => ({
    companyId: ids.clientCompanyId,
    fileIds: [ids.fileId],
    idempotencyKey: nextKey(),
    message: "Please review",
    taskId: ids.taskId,
  })),
  entry("cancelApprovalAction", approvalActions.cancelApprovalAction, () => ({
    idempotencyKey: nextKey(),
    requestId: ids.random,
  })),
];
