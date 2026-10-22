import type { ApprovalStatus } from "@/src/server/approvals/approval-contracts";

export const APPROVAL_STATUS_BADGES: Record<
  ApprovalStatus,
  { readonly label: string; readonly tone: "amber" | "gray" | "green" }
> = {
  approved: { label: "Approved", tone: "green" },
  cancelled: { label: "Withdrawn", tone: "gray" },
  changes_requested: { label: "Changes requested", tone: "amber" },
  pending: { label: "Waiting for client", tone: "gray" },
};
