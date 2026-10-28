import type { BugWorkflowStatusSchema } from "./bug-contracts";

type Status = typeof BugWorkflowStatusSchema.Type;

// Every move a bug may make, from the workflow actions themselves: triage,
// investigation, the client's answer or verification, approval, release,
// withdrawal and the admin's reopen. `updateBugStatus` refuses anything else,
// so a caller with a wrong check cannot push a bug somewhere it cannot be.
// The record type makes a new status fail to compile until it is placed here.
const EDGES: Readonly<Record<Status, readonly Status[]>> = {
  approved_for_release: ["released"],
  awaiting_admin_approval: ["approved_for_release", "rejected"],
  awaiting_client: ["closed", "triaged", "reported", "in_progress"],
  closed: ["in_progress"],
  duplicate: ["awaiting_client"],
  // A move to the same status is the fix attempt being updated in place.
  in_progress: [
    "in_progress",
    "in_verification",
    "awaiting_admin_approval",
    "needs_info",
    "closed",
  ],
  in_verification: ["in_progress", "awaiting_admin_approval", "needs_info"],
  // Answered, the bug returns to the status it was asked from.
  needs_info: ["triaged", "in_progress", "in_verification", "closed"],
  rejected: ["in_progress"],
  released: ["closed", "awaiting_client"],
  // "closed" here is the handler closing a report as not a bug.
  reported: ["triaged", "duplicate", "withdrawn", "closed"],
  triaged: ["in_progress", "duplicate", "needs_info", "closed"],
  withdrawn: [],
};

export const BUG_STATUSES = Object.keys(EDGES) as readonly Status[];

export const BUG_STATUS_EDGES = EDGES;

export const canMoveBug = (from: string, to: string): boolean =>
  EDGES[from as Status]?.includes(to as Status) ?? false;
