import type { ApprovalStatus } from "@/src/server/approvals/approval-contracts";

export const approvalStatusText: Record<ApprovalStatus, string> = {
  approved: "Approved",
  cancelled: "Withdrawn",
  changes_requested: "Changes requested",
  pending: "Needs your review",
};

export const approvalStatusTone: Record<
  ApprovalStatus,
  "amber" | "gray" | "green" | "violet"
> = {
  approved: "green",
  cancelled: "gray",
  changes_requested: "amber",
  pending: "violet",
};
