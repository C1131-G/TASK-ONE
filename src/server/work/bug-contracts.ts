import { Schema } from "effect";

import { UUIDSchema } from "../core/input-schemas";

const RequiredTextSchema = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(10_000),
  Schema.makeFilter((value) =>
    value.trim() ? undefined : "This field is required."
  )
);
const OptionalDiscoveryTextSchema = Schema.NullOr(
  Schema.String.check(Schema.isMaxLength(500))
);

export const BugSeveritySchema = Schema.Literals([
  "blocker",
  "critical",
  "major",
  "minor",
  "trivial",
]);

export const BugDiscoverySourceSchema = Schema.Literals([
  "internal_qa",
  "customer_report",
  "support",
  "automated_test",
  "monitoring",
  "employee_report",
]);

export const BugEnvironmentSchema = Schema.Literals([
  "production",
  "staging",
  "development",
  "test",
  "other",
]);

export const BugWorkflowStatusSchema = Schema.Literals([
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
]);

export const BugReportInputSchema = Schema.Struct({
  actualBehavior: RequiredTextSchema,
  appVersion: OptionalDiscoveryTextSchema,
  browser: OptionalDiscoveryTextSchema,
  component: RequiredTextSchema,
  description: Schema.NullOr(Schema.String.check(Schema.isMaxLength(10_000))),
  device: OptionalDiscoveryTextSchema,
  discoverySource: BugDiscoverySourceSchema,
  environment: BugEnvironmentSchema,
  expectedBehavior: RequiredTextSchema,
  os: OptionalDiscoveryTextSchema,
  projectId: UUIDSchema,
  reproductionSteps: Schema.Array(RequiredTextSchema).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(30)
  ),
  route: RequiredTextSchema,
  severity: BugSeveritySchema,
  title: RequiredTextSchema.check(Schema.isMaxLength(300)),
});

export const BugListInputSchema = Schema.Struct({
  includeArchived: Schema.optional(Schema.Boolean),
  projectId: Schema.optional(UUIDSchema),
  query: Schema.optional(Schema.String.check(Schema.isMaxLength(300))),
  severity: Schema.optional(BugSeveritySchema),
  status: Schema.optional(BugWorkflowStatusSchema),
});

export const BugIdInputSchema = Schema.Struct({ bugId: UUIDSchema });

export const BugTriageInputSchema = Schema.Struct({
  assigneeIds: Schema.Array(UUIDSchema).check(Schema.isMaxLength(100)),
  bugId: UUIDSchema,
  expectedVersion: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
  priority: Schema.Literals(["urgent", "high", "medium", "low", "none"]),
  severity: BugSeveritySchema,
});

export const BugRelationInputSchema = Schema.Struct({
  bugId: UUIDSchema,
  expectedVersion: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
  relatedBugId: UUIDSchema,
  type: Schema.Literals(["recurrence", "duplicate"]),
});

export const BugFixAttemptInputSchema = Schema.Struct({
  affectedVersion: OptionalDiscoveryTextSchema,
  bugId: UUIDSchema,
  commitUrl: Schema.NullOr(Schema.String.check(Schema.isMaxLength(2048))),
  expectedVersion: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
  fixSummary: RequiredTextSchema,
  fixedVersion: OptionalDiscoveryTextSchema,
  pullRequestUrl: Schema.NullOr(Schema.String.check(Schema.isMaxLength(2048))),
  rootCause: RequiredTextSchema,
  verificationSteps: Schema.Array(RequiredTextSchema).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(30)
  ),
});

export const BugVerificationInputSchema = Schema.Struct({
  attemptId: UUIDSchema,
  bugId: UUIDSchema,
  expectedVersion: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
  notes: RequiredTextSchema,
  outcome: Schema.Literals(["passed", "failed"]),
  testedEnvironment: BugEnvironmentSchema,
  testedVersion: RequiredTextSchema,
});

export const BugSubmitApprovalInputSchema = Schema.Struct({
  bugId: UUIDSchema,
  expectedVersion: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
  fixAttemptId: UUIDSchema,
});

export const BugApprovalDecisionInputSchema = Schema.Struct({
  approvalId: UUIDSchema,
  comment: Schema.NullOr(Schema.String.check(Schema.isMaxLength(10_000))),
  decision: Schema.Literals(["approved", "rejected"]),
  expectedVersion: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
  rejectionReason: Schema.NullOr(Schema.String.check(Schema.isMaxLength(2000))),
});

export const BugReleaseInputSchema = Schema.Struct({
  approvalId: UUIDSchema,
  bugId: UUIDSchema,
  environment: BugEnvironmentSchema,
  expectedVersion: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
  notes: Schema.NullOr(Schema.String.check(Schema.isMaxLength(10_000))),
  version: RequiredTextSchema.check(Schema.isMaxLength(200)),
});

export const BugPostReleaseCheckInputSchema = Schema.Struct({
  bugId: UUIDSchema,
  expectedVersion: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
  notes: RequiredTextSchema,
  passed: Schema.Boolean,
  releaseId: UUIDSchema,
});

export const BugEvidenceInputSchema = Schema.Struct({
  bugId: UUIDSchema,
  caption: RequiredTextSchema.check(Schema.isMaxLength(2000)),
  expectedVersion: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
  externalUrl: Schema.NullOr(Schema.String.check(Schema.isMaxLength(2048))),
  fileAssetId: Schema.NullOr(UUIDSchema),
  fixAttemptId: Schema.NullOr(UUIDSchema),
  kind: Schema.Literals(["before", "after", "other"]),
});

export const BugHistoryInputSchema = Schema.Struct({ bugId: UUIDSchema });
export const BugVersionInputSchema = Schema.Struct({
  bugId: UUIDSchema,
  expectedVersion: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
});
export const BugApprovalInboxInputSchema = Schema.Struct({
  status: Schema.optional(Schema.Literals(["pending", "approved", "rejected"])),
});

export type BugReportInput = typeof BugReportInputSchema.Type;
export type BugListInput = typeof BugListInputSchema.Type;
export type BugTriageInput = typeof BugTriageInputSchema.Type;
export type BugRelationInput = typeof BugRelationInputSchema.Type;
export type BugFixAttemptInput = typeof BugFixAttemptInputSchema.Type;
export type BugVerificationInput = typeof BugVerificationInputSchema.Type;
export type BugSubmitApprovalInput = typeof BugSubmitApprovalInputSchema.Type;
export type BugApprovalDecisionInput =
  typeof BugApprovalDecisionInputSchema.Type;
export type BugReleaseInput = typeof BugReleaseInputSchema.Type;
export type BugPostReleaseCheckInput =
  typeof BugPostReleaseCheckInputSchema.Type;
export type BugEvidenceInput = typeof BugEvidenceInputSchema.Type;
export type BugVersionInput = typeof BugVersionInputSchema.Type;
