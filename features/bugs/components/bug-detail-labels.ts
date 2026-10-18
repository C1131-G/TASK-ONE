import type { BugHistorySchema } from "@/src/server/work/bug-history";

export type BugHistory = typeof BugHistorySchema.Type;

export const statusLabels: Record<BugHistory["bug"]["status"], string> = {
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

export const formatDate = (value: string): string =>
  dateFormatter.format(new Date(value));
