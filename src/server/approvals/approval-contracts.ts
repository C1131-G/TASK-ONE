import type { Effect } from "effect";
import { Context, Schema } from "effect";

import type { AppError } from "../core/action-result";
import { UUIDSchema } from "../core/input-schemas";

export const MAX_APPROVAL_FILES = 10;
export const MAX_APPROVAL_TEXT = 2000;

export const ApprovalStatusSchema = Schema.Literals([
  "pending",
  "approved",
  "changes_requested",
  "cancelled",
]);
export type ApprovalStatus = typeof ApprovalStatusSchema.Type;

export const ApprovalDecisionSchema = Schema.Literals([
  "approve",
  "request_changes",
]);
export type ApprovalDecision = typeof ApprovalDecisionSchema.Type;

// Exactly one of taskId and milestoneId is given; the service checks it so a
// bad pair reads as a validation error rather than a schema one.
export const RequestApprovalInputSchema = Schema.Struct({
  companyId: UUIDSchema,
  fileIds: Schema.Array(UUIDSchema).check(
    Schema.isMaxLength(MAX_APPROVAL_FILES)
  ),
  message: Schema.String.check(Schema.isMaxLength(MAX_APPROVAL_TEXT)),
  milestoneId: Schema.optional(UUIDSchema),
  taskId: Schema.optional(UUIDSchema),
});
export type RequestApprovalInput = typeof RequestApprovalInputSchema.Type;

export const ApprovalReceiptSchema = Schema.Struct({
  id: UUIDSchema,
  version: Schema.Number,
});
export type ApprovalReceipt = typeof ApprovalReceiptSchema.Type;

export const ApprovalFileSchema = Schema.Struct({
  fileId: UUIDSchema,
  fileName: Schema.String,
});

export const StaffApprovalSchema = Schema.Struct({
  cancelledAt: Schema.NullOr(Schema.String),
  companyId: UUIDSchema,
  companyName: Schema.String,
  decidedAt: Schema.NullOr(Schema.String),
  decidedByName: Schema.NullOr(Schema.String),
  decisionComment: Schema.NullOr(Schema.String),
  files: Schema.Array(ApprovalFileSchema),
  id: UUIDSchema,
  message: Schema.String,
  requestedAt: Schema.String,
  requestedByName: Schema.String,
  status: ApprovalStatusSchema,
  version: Schema.Number,
});

// What the task drawer shows: the companies a request can go to, and every
// version requested so far.
export const TaskApprovalsSchema = Schema.Struct({
  canRequest: Schema.Boolean,
  companies: Schema.Array(
    Schema.Struct({ id: UUIDSchema, name: Schema.String })
  ),
  requests: Schema.Array(StaffApprovalSchema),
});
export type TaskApprovals = typeof TaskApprovalsSchema.Type;

export const PortalApprovalSummarySchema = Schema.Struct({
  decidedAt: Schema.NullOr(Schema.String),
  fileCount: Schema.Number,
  id: UUIDSchema,
  projectName: Schema.String,
  requestedAt: Schema.String,
  requestedByName: Schema.String,
  status: ApprovalStatusSchema,
  subjectKind: Schema.Literals(["task", "milestone"]),
  subjectTitle: Schema.String,
  version: Schema.Number,
});
export type PortalApprovalSummary = typeof PortalApprovalSummarySchema.Type;

export const PortalApprovalListSchema = Schema.Array(
  PortalApprovalSummarySchema
);

export const PortalApprovalFileSchema = Schema.Struct({
  contentType: Schema.String,
  fileId: UUIDSchema,
  fileName: Schema.String,
  previewable: Schema.Boolean,
  sizeBytes: Schema.Number,
});

export const PortalApprovalHistorySchema = Schema.Struct({
  decidedAt: Schema.NullOr(Schema.String),
  decidedByName: Schema.NullOr(Schema.String),
  decisionComment: Schema.NullOr(Schema.String),
  id: UUIDSchema,
  requestedAt: Schema.String,
  status: ApprovalStatusSchema,
  version: Schema.Number,
});

export const PortalApprovalDetailSchema = Schema.Struct({
  ...PortalApprovalSummarySchema.fields,
  canDecide: Schema.Boolean,
  decidedByName: Schema.NullOr(Schema.String),
  decisionComment: Schema.NullOr(Schema.String),
  files: Schema.Array(PortalApprovalFileSchema),
  history: Schema.Array(PortalApprovalHistorySchema),
  message: Schema.String,
});
export type PortalApprovalDetail = typeof PortalApprovalDetailSchema.Type;

export const PortalApprovalIdInputSchema = Schema.Struct({
  approvalId: UUIDSchema,
});

export const DecideApprovalInputSchema = Schema.Struct({
  comment: Schema.String.check(Schema.isMaxLength(MAX_APPROVAL_TEXT)),
  decision: ApprovalDecisionSchema,
  requestId: UUIDSchema,
});
export type DecideApprovalInput = typeof DecideApprovalInputSchema.Type;

export const ApprovalDecisionReceiptSchema = Schema.Struct({
  requestId: UUIDSchema,
  status: ApprovalStatusSchema,
});
export type ApprovalDecisionReceipt = typeof ApprovalDecisionReceiptSchema.Type;

export class Approvals extends Context.Service<
  Approvals,
  {
    readonly request: (
      actorId: string,
      input: RequestApprovalInput
    ) => Effect.Effect<ApprovalReceipt, AppError>;
    readonly cancel: (
      actorId: string,
      requestId: string
    ) => Effect.Effect<void, AppError>;
    readonly forTask: (
      actorId: string,
      taskId: string
    ) => Effect.Effect<TaskApprovals, AppError>;
  }
>()("metsys/server/Approvals") {}
