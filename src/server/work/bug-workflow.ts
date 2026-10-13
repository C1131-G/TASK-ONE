import { Schema } from "effect";

import { AppError } from "../core/action-result";
import { BugWorkflowStatusSchema } from "./bug-contracts";

const BugRoleSchema = Schema.Literals(["admin", "employee"]);

export const BugTransitionInputSchema = Schema.Struct({
  actorRole: BugRoleSchema,
  currentStatus: BugWorkflowStatusSchema,
  hasSuccessfulPostReleaseCheck: Schema.optional(Schema.Boolean),
  hasVerifiedBeforeAndAfterEvidence: Schema.optional(Schema.Boolean),
  nextStatus: BugWorkflowStatusSchema,
});

type TransitionInput = typeof BugTransitionInputSchema.Type;

const fail = (message: string): never => {
  throw new AppError({ code: "FORBIDDEN", message });
};

export const hasRequiredBugEvidence = (
  evidence: readonly {
    readonly fixAttemptId: string | null;
    readonly kind: "before" | "after" | "other";
  }[],
  fixAttemptId: string
): boolean => {
  const relevantEvidence = evidence.filter(
    (item) => item.fixAttemptId === null || item.fixAttemptId === fixAttemptId
  );
  return (
    relevantEvidence.some((item) => item.kind === "before") &&
    relevantEvidence.some((item) => item.kind === "after")
  );
};

export const transitionBugStatus = (
  rawInput: TransitionInput
): typeof BugWorkflowStatusSchema.Type => {
  const input = Schema.decodeUnknownSync(BugTransitionInputSchema)(rawInput);
  const { actorRole, currentStatus, nextStatus } = input;
  if (
    actorRole !== "admin" &&
    currentStatus === "awaiting_admin_approval" &&
    nextStatus === "approved_for_release"
  ) {
    fail("Only admins can approve bugs for release.");
  }
  if (
    actorRole !== "admin" &&
    currentStatus === "closed" &&
    nextStatus === "in_progress"
  ) {
    fail("Only admins can reopen a closed bug.");
  }
  if (
    actorRole !== "admin" &&
    [
      "triaged",
      "approved_for_release",
      "released",
      "closed",
      "duplicate",
    ].includes(nextStatus)
  ) {
    fail("Only admins can perform this bug workflow transition.");
  }

  const allowedTransitions: Record<
    typeof BugWorkflowStatusSchema.Type,
    readonly (typeof BugWorkflowStatusSchema.Type)[]
  > = {
    approved_for_release: ["released"],
    awaiting_admin_approval: ["approved_for_release", "rejected"],
    closed: ["in_progress"],
    duplicate: [],
    in_progress: ["in_verification", "awaiting_admin_approval"],
    in_verification: ["in_progress", "awaiting_admin_approval"],
    rejected: ["in_progress"],
    released: ["closed"],
    reported: ["triaged", "duplicate"],
    triaged: ["in_progress", "duplicate"],
  };

  if (!allowedTransitions[currentStatus].includes(nextStatus)) {
    fail("This bug workflow transition is not allowed.");
  }
  if (
    nextStatus === "awaiting_admin_approval" &&
    !input.hasVerifiedBeforeAndAfterEvidence
  ) {
    fail("A verified fix with before and after evidence is required.");
  }
  if (nextStatus === "closed" && !input.hasSuccessfulPostReleaseCheck) {
    fail("A successful post-release check is required before closing.");
  }
  return Schema.decodeUnknownSync(BugWorkflowStatusSchema)(nextStatus);
};
