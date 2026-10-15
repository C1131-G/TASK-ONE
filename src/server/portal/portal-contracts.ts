import type { Effect } from "effect";
import { Context, Schema } from "effect";

import { clientStatusLabels } from "@/features/portal/client-status";

import type { AppError } from "../core/action-result";
import { UUIDSchema } from "../core/input-schemas";
import { ClientImpactSchema } from "../work/bug-contracts";

const VersionSchema = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThan(0)
);
const RequiredTextSchema = Schema.String.check(
  Schema.isMaxLength(10_000),
  Schema.makeFilter((value) =>
    value.trim() ? undefined : "This field is required."
  )
);
const ShortTextSchema = Schema.NullOr(
  Schema.String.check(Schema.isMaxLength(500))
);

export const ClientStatusLabelSchema = Schema.Literals(clientStatusLabels);

// The fields a client fills in to describe a bug.
const ClientBugFields = {
  actualBehavior: RequiredTextSchema,
  browser: ShortTextSchema,
  description: Schema.NullOr(Schema.String.check(Schema.isMaxLength(10_000))),
  device: ShortTextSchema,
  expectedBehavior: RequiredTextSchema,
  impact: ClientImpactSchema,
  os: ShortTextSchema,
  pageUrl: RequiredTextSchema.check(Schema.isMaxLength(2000)),
  reproductionSteps: Schema.Array(RequiredTextSchema).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(30)
  ),
  title: RequiredTextSchema.check(Schema.isMaxLength(300)),
} as const;

export const SubmitClientBugInputSchema = Schema.Struct({
  ...ClientBugFields,
  projectId: UUIDSchema,
});

export const EditClientBugInputSchema = Schema.Struct({
  ...ClientBugFields,
  bugId: UUIDSchema,
  expectedVersion: VersionSchema,
});

export const ClientBugVersionInputSchema = Schema.Struct({
  bugId: UUIDSchema,
  expectedVersion: VersionSchema,
});

export const ClientBugIdInputSchema = Schema.Struct({ bugId: UUIDSchema });

export const ClientCommentInputSchema = Schema.Struct({
  body: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(10_000)),
  bugId: UUIDSchema,
});

export const AttachClientFileInputSchema = Schema.Struct({
  bugId: UUIDSchema,
  fileId: UUIDSchema,
});

export const ListCompanyBugsInputSchema = Schema.Struct({
  mine: Schema.optional(Schema.Boolean),
  projectId: Schema.optional(UUIDSchema),
  status: Schema.optional(ClientStatusLabelSchema),
});

export type SubmitClientBugInput = typeof SubmitClientBugInputSchema.Type;
export type EditClientBugInput = typeof EditClientBugInputSchema.Type;
export type ClientBugVersionInput = typeof ClientBugVersionInputSchema.Type;
export type ClientCommentInput = typeof ClientCommentInputSchema.Type;
export type AttachClientFileInput = typeof AttachClientFileInputSchema.Type;
export type ListCompanyBugsInput = typeof ListCompanyBugsInputSchema.Type;

export const PortalProjectSchema = Schema.Struct({
  id: UUIDSchema,
  key: Schema.String,
  name: Schema.String,
});

export const PortalBugSummarySchema = Schema.Struct({
  createdAt: Schema.String,
  id: UUIDSchema,
  impact: Schema.NullOr(ClientImpactSchema),
  isMine: Schema.Boolean,
  key: Schema.String,
  projectId: UUIDSchema,
  projectName: Schema.String,
  reporterName: Schema.String,
  status: ClientStatusLabelSchema,
  title: Schema.String,
  updatedAt: Schema.String,
});

export const PortalBugListSchema = Schema.Array(PortalBugSummarySchema);

export const PortalCommentSchema = Schema.Struct({
  authorName: Schema.String,
  body: Schema.String,
  createdAt: Schema.String,
  id: UUIDSchema,
  isMine: Schema.Boolean,
  isTeam: Schema.Boolean,
});

export const PortalTimelineEntrySchema = Schema.Struct({
  at: Schema.String,
  status: ClientStatusLabelSchema,
});

export const PortalAttachmentSchema = Schema.Struct({
  contentType: Schema.String,
  createdAt: Schema.String,
  fileId: UUIDSchema,
  fileName: Schema.String,
  previewable: Schema.Boolean,
  sizeBytes: Schema.Number,
  uploaderName: Schema.String,
});

export const PortalBugDetailSchema = Schema.Struct({
  ...PortalBugSummarySchema.fields,
  actualBehavior: Schema.String,
  attachments: Schema.Array(PortalAttachmentSchema),
  browser: Schema.NullOr(Schema.String),
  canAttach: Schema.Boolean,
  canComment: Schema.Boolean,
  canEdit: Schema.Boolean,
  canWithdraw: Schema.Boolean,
  comments: Schema.Array(PortalCommentSchema),
  description: Schema.NullOr(Schema.String),
  device: Schema.NullOr(Schema.String),
  expectedBehavior: Schema.String,
  os: Schema.NullOr(Schema.String),
  pageUrl: Schema.String,
  reproductionSteps: Schema.Array(Schema.String),
  timeline: Schema.Array(PortalTimelineEntrySchema),
  version: VersionSchema,
});

export const PortalBugReceiptSchema = Schema.Struct({
  bugId: UUIDSchema,
  version: VersionSchema,
});

export const PortalNotificationSchema = Schema.Struct({
  bugId: Schema.NullOr(UUIDSchema),
  createdAt: Schema.String,
  id: UUIDSchema,
  readAt: Schema.NullOr(Schema.String),
  snippet: Schema.NullOr(Schema.String),
  text: Schema.String,
});

export const PortalNotificationListSchema = Schema.Struct({
  items: Schema.Array(PortalNotificationSchema),
  unreadCount: Schema.Number,
});

export type PortalProject = typeof PortalProjectSchema.Type;
export type PortalBugSummary = typeof PortalBugSummarySchema.Type;
export type PortalBugDetail = typeof PortalBugDetailSchema.Type;
export type PortalBugReceipt = typeof PortalBugReceiptSchema.Type;
export type PortalComment = typeof PortalCommentSchema.Type;
export type PortalNotificationList = typeof PortalNotificationListSchema.Type;

// Who is asking. The company comes from the signed-in client's session, never
// from the request.
export interface PortalActor {
  readonly id: string;
  readonly clientCompanyId: string;
  readonly name: string;
}

export class PortalBugs extends Context.Service<
  PortalBugs,
  {
    readonly listProjects: (
      actor: PortalActor
    ) => Effect.Effect<readonly PortalProject[], AppError>;
    readonly listBugs: (
      actor: PortalActor,
      input: ListCompanyBugsInput
    ) => Effect.Effect<readonly PortalBugSummary[], AppError>;
    readonly getBug: (
      actor: PortalActor,
      bugId: string
    ) => Effect.Effect<PortalBugDetail, AppError>;
    readonly submitBug: (
      actor: PortalActor,
      input: SubmitClientBugInput
    ) => Effect.Effect<PortalBugReceipt, AppError>;
    readonly editBug: (
      actor: PortalActor,
      input: EditClientBugInput
    ) => Effect.Effect<PortalBugReceipt, AppError>;
    readonly withdrawBug: (
      actor: PortalActor,
      input: ClientBugVersionInput
    ) => Effect.Effect<PortalBugReceipt, AppError>;
    readonly addComment: (
      actor: PortalActor,
      input: ClientCommentInput
    ) => Effect.Effect<PortalComment, AppError>;
    readonly attachFile: (
      actor: PortalActor,
      input: AttachClientFileInput
    ) => Effect.Effect<void, AppError>;
    readonly taskIdForBug: (
      actor: PortalActor,
      bugId: string
    ) => Effect.Effect<string, AppError>;
    readonly listNotifications: (
      actor: PortalActor
    ) => Effect.Effect<PortalNotificationList, AppError>;
  }
>()("metsys/server/PortalBugs") {}
