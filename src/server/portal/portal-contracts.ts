import type { Effect } from "effect";
import { Context, Schema } from "effect";

import type { AppError } from "../core/action-result";
import { UUIDSchema } from "../core/input-schemas";
import { ClientImpactSchema } from "../work/bug-contracts";
import type {
  AttachClientFileInput,
  ClientBugVersionInput,
  ClientCommentInput,
  ConfirmClientFixInput,
  EditClientBugInput,
  ListCompanyBugsInput,
  RateClientBugInput,
  ReopenClientFixInput,
  SubmitClientBugInput,
} from "./portal-input-contracts";
import {
  SatisfactionSchema,
  VersionSchema,
  ClientStatusLabelSchema,
} from "./portal-input-contracts";

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

export const PortalLifecycleSchema = Schema.Struct({
  canRate: Schema.Boolean,
  canReportAgain: Schema.Boolean,
  // Why a closed bug was closed.
  closedReason: Schema.NullOr(
    Schema.Literals(["confirmed", "unconfirmed", "no_response", "not_a_bug"])
  ),
  // Set when the bug was merged into another one the team is tracking. The
  // original's title is only given when it is also this company's bug.
  duplicateOf: Schema.NullOr(
    Schema.Struct({
      key: Schema.NullOr(Schema.String),
      status: ClientStatusLabelSchema,
      title: Schema.NullOr(Schema.String),
    })
  ),
  // Set while the team waits on the client for an answer.
  question: Schema.NullOr(
    Schema.Struct({
      askedAt: Schema.String,
      text: Schema.NullOr(Schema.String),
    })
  ),
  rating: Schema.NullOr(
    Schema.Struct({
      comment: Schema.NullOr(Schema.String),
      satisfaction: SatisfactionSchema,
    })
  ),
  // Set while the client is asked to verify a fix.
  verification: Schema.NullOr(
    Schema.Struct({
      canReopen: Schema.Boolean,
      // False when the report is read only; the client can neither confirm
      // nor reopen.
      canRespond: Schema.Boolean,
      reopensLeft: Schema.Number,
      since: Schema.String,
    })
  ),
});

// "We usually respond within X": first-response targets in business time.
export const PortalResponseTimesSchema = Schema.Struct({
  businessDays: Schema.Array(Schema.Number),
  businessEndMinute: Schema.Number,
  businessStartMinute: Schema.Number,
  firstResponseMinutes: Schema.Struct({
    high: Schema.Number,
    low: Schema.Number,
    medium: Schema.Number,
    urgent: Schema.Number,
  }),
  timeZone: Schema.String,
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
  // The team's first response: when it came, or the target for this bug.
  firstResponse: Schema.Struct({
    respondedAt: Schema.NullOr(Schema.String),
    targetMinutes: Schema.NullOr(Schema.Number),
  }),
  lifecycle: PortalLifecycleSchema,
  os: Schema.NullOr(Schema.String),
  pageUrl: Schema.String,
  // Why nothing can be changed, when the project left the company.
  readOnlyReason: Schema.NullOr(Schema.String),
  reproductionSteps: Schema.Array(Schema.String),
  timeline: Schema.Array(PortalTimelineEntrySchema),
  version: VersionSchema,
});

export const PortalBugReceiptSchema = Schema.Struct({
  bugId: UUIDSchema,
  version: VersionSchema,
});

export const PortalNotificationSchema = Schema.Struct({
  approvalId: Schema.NullOr(UUIDSchema),
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

export type PortalResponseTimes = typeof PortalResponseTimesSchema.Type;
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
    readonly responseTimes: (
      actor: PortalActor
    ) => Effect.Effect<PortalResponseTimes, AppError>;
    readonly listBugs: (
      actor: PortalActor,
      input: ListCompanyBugsInput
    ) => Effect.Effect<readonly PortalBugSummary[], AppError>;
    readonly listBugPage: (
      actor: PortalActor,
      input: ListCompanyBugsInput,
      options?: {
        readonly cursor?: string | undefined;
        readonly limit?: number | undefined;
      }
    ) => Effect.Effect<
      {
        readonly items: readonly PortalBugSummary[];
        readonly nextCursor: string | null;
      },
      AppError
    >;
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
    readonly confirmFix: (
      actor: PortalActor,
      input: ConfirmClientFixInput
    ) => Effect.Effect<PortalBugReceipt, AppError>;
    readonly reopenFix: (
      actor: PortalActor,
      input: ReopenClientFixInput
    ) => Effect.Effect<PortalBugReceipt, AppError>;
    readonly rateBug: (
      actor: PortalActor,
      input: RateClientBugInput
    ) => Effect.Effect<void, AppError>;
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
>()("taskora/server/PortalBugs") {}
