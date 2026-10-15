import type { BugWorkflowStatusSchema } from "@/src/server/work/bug-contracts";

type BugWorkflowStatus = typeof BugWorkflowStatusSchema.Type;

// What a client sees for each internal bug status. Several internal stages
// collapse into one label so the portal never exposes internal process.
export const clientStatusLabels = [
  "submitted",
  "acknowledged",
  "in_progress",
  "waiting_for_reply",
  "fix_ready",
  "closed",
  "merged",
  "not_a_bug",
  "withdrawn",
] as const;

export type ClientStatusLabel = (typeof clientStatusLabels)[number];

export const clientStatusLabel = (
  status: BugWorkflowStatus,
  resolution: string | null = null
): ClientStatusLabel => {
  // A bug declined as not a bug is closed with that resolution.
  if (status === "closed" && resolution === "not_a_bug") {
    return "not_a_bug";
  }
  switch (status) {
    case "reported": {
      return "submitted";
    }
    case "triaged": {
      return "acknowledged";
    }
    // Internally "rejected" means an admin sent a fix back for changes, so
    // the work is still in progress from the client's point of view.
    case "in_progress":
    case "in_verification":
    case "awaiting_admin_approval":
    case "approved_for_release":
    case "rejected":
    case "released": {
      return "in_progress";
    }
    case "needs_info": {
      return "waiting_for_reply";
    }
    case "awaiting_client": {
      return "fix_ready";
    }
    case "closed": {
      return "closed";
    }
    case "duplicate": {
      return "merged";
    }
    case "withdrawn": {
      return "withdrawn";
    }
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
};

export const clientStatusText: Record<ClientStatusLabel, string> = {
  acknowledged: "Acknowledged",
  closed: "Closed",
  fix_ready: "Fix ready – please verify",
  in_progress: "In progress",
  merged: "Merged – already tracking",
  not_a_bug: "Not a bug",
  submitted: "Submitted",
  waiting_for_reply: "Waiting for your reply",
  withdrawn: "Withdrawn",
};

// Internal statuses a client label covers, for filtering company bugs.
export const internalStatusesFor = (
  label: ClientStatusLabel
): readonly BugWorkflowStatus[] =>
  (
    [
      "reported",
      "triaged",
      "in_progress",
      "in_verification",
      "awaiting_admin_approval",
      "approved_for_release",
      "released",
      "closed",
      "duplicate",
      "rejected",
      "needs_info",
      "awaiting_client",
      "withdrawn",
    ] as const
  ).filter((status) => clientStatusLabel(status) === label);

export const isOpenClientLabel = (label: ClientStatusLabel): boolean =>
  !["closed", "merged", "not_a_bug", "withdrawn"].includes(label);
