import { Schema } from "effect";

import type { RouteDefinition } from "./route-definition";

// Bug actions: staff and client context, pickup, information, evidence, verification, approvals.
// Owned by one branch, so adding routes here never conflicts with the others.
// This file imports nothing from the server, so every shape is spelled out here
// and a test decodes real responses against it.

const Uuid = Schema.String.check(Schema.isUUID());
const Version = Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0));
const Text = Schema.String.check(
  Schema.isMaxLength(10_000),
  Schema.makeFilter((value) =>
    value.trim() ? undefined : "This field is required."
  )
);
const ShortText = Schema.NullOr(Schema.String.check(Schema.isMaxLength(500)));
const Flag = Schema.Literals(["true", "false"]);

export const ClientImpact = Schema.Literals([
  "low",
  "medium",
  "high",
  "urgent",
]);
export const ClientStatus = Schema.Literals([
  "submitted",
  "acknowledged",
  "in_progress",
  "waiting_for_reply",
  "fix_ready",
  "closed",
  "merged",
  "not_a_bug",
  "withdrawn",
]);
const Satisfaction = Schema.Literals(["up", "down"]);

// ---- Portal (client) ----

const BugIdParams = Schema.Struct({ bugId: Uuid });

// What a client describes. Attachments will join this list in their own
// branch, so keep it a plain struct that is easy to extend.
export const PortalReportBody = Schema.Struct({
  actualBehavior: Text,
  browser: ShortText,
  description: Schema.NullOr(Schema.String.check(Schema.isMaxLength(10_000))),
  device: ShortText,
  expectedBehavior: Text,
  impact: ClientImpact,
  os: ShortText,
  pageUrl: Text.check(Schema.isMaxLength(2000)),
  projectId: Uuid,
  reproductionSteps: Schema.Array(Text).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(30)
  ),
  title: Text.check(Schema.isMaxLength(300)),
});

export const PortalReceipt = Schema.Struct({
  bugId: Uuid,
  version: Version,
});

export const PortalBugSummary = Schema.Struct({
  createdAt: Schema.String,
  id: Uuid,
  impact: Schema.NullOr(ClientImpact),
  isMine: Schema.Boolean,
  key: Schema.String,
  projectId: Uuid,
  projectName: Schema.String,
  reporterName: Schema.String,
  status: ClientStatus,
  title: Schema.String,
  updatedAt: Schema.String,
});

const PortalComment = Schema.Struct({
  authorName: Schema.String,
  body: Schema.String,
  createdAt: Schema.String,
  id: Uuid,
  isMine: Schema.Boolean,
  isTeam: Schema.Boolean,
});

const PortalAttachment = Schema.Struct({
  contentType: Schema.String,
  createdAt: Schema.String,
  fileId: Uuid,
  fileName: Schema.String,
  previewable: Schema.Boolean,
  sizeBytes: Schema.Number,
  uploaderName: Schema.String,
});

const PortalLifecycle = Schema.Struct({
  canRate: Schema.Boolean,
  canReportAgain: Schema.Boolean,
  closedReason: Schema.NullOr(
    Schema.Literals(["confirmed", "unconfirmed", "no_response", "not_a_bug"])
  ),
  duplicateOf: Schema.NullOr(
    Schema.Struct({
      key: Schema.NullOr(Schema.String),
      status: ClientStatus,
      title: Schema.NullOr(Schema.String),
    })
  ),
  question: Schema.NullOr(
    Schema.Struct({
      askedAt: Schema.String,
      text: Schema.NullOr(Schema.String),
    })
  ),
  rating: Schema.NullOr(
    Schema.Struct({
      comment: Schema.NullOr(Schema.String),
      satisfaction: Satisfaction,
    })
  ),
  verification: Schema.NullOr(
    Schema.Struct({
      canReopen: Schema.Boolean,
      canRespond: Schema.Boolean,
      reopensLeft: Schema.Number,
      since: Schema.String,
    })
  ),
});

export const PortalBugDetail = Schema.Struct({
  ...PortalBugSummary.fields,
  actualBehavior: Schema.String,
  attachments: Schema.Array(PortalAttachment),
  browser: Schema.NullOr(Schema.String),
  canAttach: Schema.Boolean,
  canComment: Schema.Boolean,
  canEdit: Schema.Boolean,
  canWithdraw: Schema.Boolean,
  comments: Schema.Array(PortalComment),
  description: Schema.NullOr(Schema.String),
  device: Schema.NullOr(Schema.String),
  expectedBehavior: Schema.String,
  firstResponse: Schema.Struct({
    respondedAt: Schema.NullOr(Schema.String),
    targetMinutes: Schema.NullOr(Schema.Number),
  }),
  lifecycle: PortalLifecycle,
  os: Schema.NullOr(Schema.String),
  pageUrl: Schema.String,
  readOnlyReason: Schema.NullOr(Schema.String),
  reproductionSteps: Schema.Array(Schema.String),
  timeline: Schema.Array(
    Schema.Struct({ at: Schema.String, status: ClientStatus })
  ),
  version: Version,
});

export const portalBugRoutes = {
  detail: {
    data: PortalBugDetail,
    method: "get",
    operationId: "getPortalBug",
    params: BugIdParams,
    path: "/api/v1/portal/bugs/{bugId}",
    summary:
      "One of the company's bug reports, with only what a client may see.",
  },
  list: {
    data: Schema.Array(PortalBugSummary),
    method: "get",
    operationId: "listPortalBugs",
    path: "/api/v1/portal/bugs",
    query: Schema.Struct({
      mine: Schema.optional(Flag),
      projectId: Schema.optional(Uuid),
      status: Schema.optional(ClientStatus),
    }),
    summary: "The company's bug reports.",
  },
  submit: {
    body: PortalReportBody,
    data: PortalReceipt,
    method: "post",
    operationId: "submitPortalBug",
    path: "/api/v1/portal/bugs",
    summary: "Report a bug for the client's company.",
  },
} as const satisfies Record<string, RouteDefinition>;

const PortalCommentBody = Schema.Struct({
  body: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(10_000)),
});

const PortalConfirmBody = Schema.Struct({
  comment: Schema.optional(Schema.String.check(Schema.isMaxLength(2000))),
  expectedVersion: Version,
  satisfaction: Schema.optional(Satisfaction),
});

const PortalReopenBody = Schema.Struct({
  expectedVersion: Version,
  reason: Text,
});

export const portalBugActionRoutes = {
  comment: {
    body: PortalCommentBody,
    data: PortalComment,
    method: "post",
    operationId: "addPortalBugComment",
    params: BugIdParams,
    path: "/api/v1/portal/bugs/{bugId}/comments",
    summary: "Answer the team or reply on one of the company's bug reports.",
  },
  confirm: {
    body: PortalConfirmBody,
    data: PortalReceipt,
    method: "post",
    operationId: "confirmPortalBugFix",
    params: BugIdParams,
    path: "/api/v1/portal/bugs/{bugId}/confirm",
    summary: "Confirm that the fix works, which closes the report.",
  },
  reopen: {
    body: PortalReopenBody,
    data: PortalReceipt,
    method: "post",
    operationId: "reopenPortalBugFix",
    params: BugIdParams,
    path: "/api/v1/portal/bugs/{bugId}/reopen",
    summary:
      "Say the fix did not work, with the reason, to send the report back.",
  },
} as const satisfies Record<string, RouteDefinition>;

export const bugRoutes = [
  portalBugRoutes.list,
  portalBugRoutes.submit,
  portalBugRoutes.detail,
  portalBugActionRoutes.comment,
  portalBugActionRoutes.confirm,
  portalBugActionRoutes.reopen,
] as const satisfies readonly RouteDefinition[];
