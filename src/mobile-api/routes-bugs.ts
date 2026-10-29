import { Schema } from "effect";

import type { RouteDefinition } from "./route-definition";
import { NextCursorSchema, PageQuerySchema } from "./routes-paging";

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

export const PortalBugPage = Schema.Struct({
  items: Schema.Array(PortalBugSummary),
  nextCursor: NextCursorSchema,
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
  page: {
    data: PortalBugPage,
    method: "get",
    operationId: "listPortalBugPage",
    path: "/api/v1/portal/bug-reports",
    query: Schema.Struct({
      ...PageQuerySchema.fields,
      mine: Schema.optional(Flag),
      projectId: Schema.optional(Uuid),
      status: Schema.optional(ClientStatus),
    }),
    summary:
      "The company's bug reports, newest first, one page at a time. Takes the same filters as the older list.",
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

// ---- Portal (client) approvals ----

const PortalApprovalDomainStatus = Schema.Literals([
  "pending",
  "approved",
  "changes_requested",
  "cancelled",
]);

// The app's list contract: one line per request, with "rejected" standing for
// the domain's "changes_requested". The detail keeps the domain statuses.
const PortalApprovalItem = Schema.Struct({
  id: Uuid,
  projectName: Schema.String,
  requestedBy: Schema.String,
  status: Schema.Literals(["pending", "approved", "rejected"]),
  title: Schema.String,
});

export const PortalApprovalList = Schema.Struct({
  items: Schema.Array(PortalApprovalItem),
  nextCursor: NextCursorSchema,
});

const PortalApprovalParams = Schema.Struct({ requestId: Uuid });

const PortalApprovalFile = Schema.Struct({
  contentType: Schema.String,
  fileId: Uuid,
  fileName: Schema.String,
  previewable: Schema.Boolean,
  sizeBytes: Schema.Number,
});

const PortalApprovalHistory = Schema.Struct({
  decidedAt: Schema.NullOr(Schema.String),
  decidedByName: Schema.NullOr(Schema.String),
  decisionComment: Schema.NullOr(Schema.String),
  id: Uuid,
  requestedAt: Schema.String,
  status: PortalApprovalDomainStatus,
  version: Version,
});

export const PortalApprovalDetail = Schema.Struct({
  canDecide: Schema.Boolean,
  decidedAt: Schema.NullOr(Schema.String),
  decidedByName: Schema.NullOr(Schema.String),
  decisionComment: Schema.NullOr(Schema.String),
  fileCount: Schema.Number,
  files: Schema.Array(PortalApprovalFile),
  history: Schema.Array(PortalApprovalHistory),
  id: Uuid,
  message: Schema.String,
  projectName: Schema.String,
  requestedAt: Schema.String,
  requestedByName: Schema.String,
  status: PortalApprovalDomainStatus,
  subjectKind: Schema.Literals(["task", "milestone"]),
  subjectTitle: Schema.String,
  version: Version,
});

const PortalApprovalDecisionBody = Schema.Struct({
  comment: Schema.String.check(Schema.isMaxLength(2000)),
  decision: Schema.Literals(["approve", "request_changes"]),
  requestId: Uuid,
});

export const PortalApprovalDecision = Schema.Struct({
  requestId: Uuid,
  status: PortalApprovalDomainStatus,
});

export const portalApprovalRoutes = {
  decide: {
    body: PortalApprovalDecisionBody,
    data: PortalApprovalDecision,
    method: "post",
    operationId: "decidePortalApproval",
    path: "/api/v1/portal/approvals/decide",
    summary: "Approve a deliverable or ask the team for changes.",
  },
  detail: {
    data: PortalApprovalDetail,
    method: "get",
    operationId: "getPortalApproval",
    params: PortalApprovalParams,
    path: "/api/v1/portal/approvals/{requestId}",
    summary: "One approval request, with its files and earlier versions.",
  },
  list: {
    data: PortalApprovalList,
    method: "get",
    operationId: "listPortalApprovals",
    path: "/api/v1/portal/approvals",
    query: PageQuerySchema,
    summary:
      "The client's pending and decided approvals, pending first, one page at a time.",
  },
} as const satisfies Record<string, RouteDefinition>;

// ---- Workspace (staff) ----

export const WorkflowStatus = Schema.Literals([
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
]);
const Severity = Schema.Literals([
  "blocker",
  "critical",
  "major",
  "minor",
  "trivial",
]);
const Priority = Schema.Literals(["urgent", "high", "medium", "low", "none"]);

export const WorkflowReceipt = Schema.Struct({
  bugId: Uuid,
  status: WorkflowStatus,
  version: Version,
});

const DiscoverySource = Schema.Literals([
  "internal_qa",
  "customer_report",
  "support",
  "automated_test",
  "monitoring",
  "employee_report",
]);
const Environment = Schema.Literals([
  "production",
  "staging",
  "development",
  "test",
  "other",
]);

// The staff view of a bug, mirroring `BugHistorySchema` in
// `src/server/work/bug-history-contracts.ts` field for field. The route file
// never imports that schema, so a test decodes a real response against this
// copy and fails when the two drift apart.
const StaffBugReport = Schema.Struct({
  actualBehavior: Schema.String,
  appVersion: Schema.NullOr(Schema.String),
  browser: Schema.NullOr(Schema.String),
  clientCompanyId: Schema.NullOr(Uuid),
  clientImpact: Schema.NullOr(ClientImpact),
  component: Schema.String,
  description: Schema.NullOr(Schema.String),
  device: Schema.NullOr(Schema.String),
  discoveredAt: Schema.String,
  discoverySource: DiscoverySource,
  environment: Environment,
  expectedBehavior: Schema.String,
  id: Uuid,
  needsReassignment: Schema.Boolean,
  os: Schema.NullOr(Schema.String),
  pickedById: Schema.NullOr(Schema.String),
  projectId: Uuid,
  projectKey: Schema.String,
  projectTaskNumber: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThan(0)
  ),
  reporterId: Uuid,
  reproductionSteps: Schema.Array(Schema.String),
  route: Schema.String,
  severity: Severity,
  status: WorkflowStatus,
  taskId: Uuid,
  title: Schema.String,
  version: Version,
});

const SlaClockView = Schema.Struct({
  dueAt: Schema.String,
  minutesLeft: Schema.NullOr(Schema.Number),
  state: Schema.Literals([
    "ok",
    "warning",
    "breached",
    "met",
    "missed",
    "paused",
  ]),
});

const SlaView = Schema.Struct({
  firstResponse: SlaClockView,
  resolution: SlaClockView,
});

const BrowserContext = Schema.Struct({
  language: Schema.String,
  path: Schema.String,
  pixelRatio: Schema.Number,
  timeZone: Schema.String,
  userAgent: Schema.String,
  viewportHeight: Schema.Number,
  viewportWidth: Schema.Number,
});

const StaffBugAttempt = Schema.Struct({
  affectedVersion: Schema.NullOr(Schema.String),
  authorId: Schema.String,
  commitUrl: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  fixSummary: Schema.String,
  fixedVersion: Schema.NullOr(Schema.String),
  id: Uuid,
  pullRequestUrl: Schema.NullOr(Schema.String),
  rootCause: Schema.String,
  testedEnvironment: Schema.NullOr(Environment),
  testedVersion: Schema.NullOr(Schema.String),
  verificationNotes: Schema.NullOr(Schema.String),
  verificationOutcome: Schema.NullOr(Schema.Literals(["passed", "failed"])),
  verificationSteps: Schema.Array(Schema.String),
  verifiedAt: Schema.NullOr(Schema.String),
  verifiedById: Schema.NullOr(Schema.String),
});

const StaffBugApproval = Schema.Struct({
  comment: Schema.NullOr(Schema.String),
  decidedAt: Schema.NullOr(Schema.String),
  decidedById: Schema.NullOr(Schema.String),
  id: Uuid,
  rejectionReason: Schema.NullOr(Schema.String),
  snapshot: Schema.Json,
  status: Schema.Literals(["pending", "approved", "rejected"]),
  submittedAt: Schema.String,
  submittedById: Schema.String,
});

const StaffBugEvidence = Schema.Struct({
  caption: Schema.String,
  createdAt: Schema.String,
  externalUrl: Schema.NullOr(Schema.String),
  file: Schema.NullOr(
    Schema.Struct({
      contentType: Schema.NullOr(Schema.String),
      id: Uuid,
      name: Schema.String,
      sizeBytes: Schema.Number,
    })
  ),
  id: Uuid,
  kind: Schema.Literals(["before", "after", "other"]),
  uploadedBy: Schema.Struct({ id: Schema.String, name: Schema.String }),
});

export const StaffBugHistory = Schema.Struct({
  approvals: Schema.Array(StaffBugApproval),
  archived: Schema.Boolean,
  assignees: Schema.Array(
    Schema.Struct({ id: Schema.String, name: Schema.String })
  ),
  attempts: Schema.Array(StaffBugAttempt),
  bug: StaffBugReport,
  clientContext: Schema.NullOr(BrowserContext),
  clientReport: Schema.NullOr(
    Schema.Struct({
      awaitingClientSince: Schema.NullOr(Schema.String),
      canAskClient: Schema.Boolean,
      canCloseNotABug: Schema.Boolean,
      canPick: Schema.Boolean,
      companyId: Uuid,
      companyName: Schema.String,
      needsInfoSince: Schema.NullOr(Schema.String),
      pickedAt: Schema.NullOr(Schema.String),
      pickedByName: Schema.NullOr(Schema.String),
      reopenCount: Schema.Number,
      resolution: Schema.NullOr(Schema.String),
      satisfaction: Schema.NullOr(Satisfaction),
      satisfactionComment: Schema.NullOr(Schema.String),
      sla: Schema.NullOr(SlaView),
    })
  ),
  evidence: Schema.Array(StaffBugEvidence),
  priority: Priority,
  relations: Schema.Array(
    Schema.Struct({
      bug: StaffBugReport,
      type: Schema.Literals(["duplicate", "recurrence"]),
    })
  ),
  releases: Schema.Array(
    Schema.Struct({
      checkedAt: Schema.NullOr(Schema.String),
      environment: Environment,
      id: Uuid,
      postReleaseCheckNotes: Schema.NullOr(Schema.String),
      postReleaseCheckPassed: Schema.Boolean,
      releasedAt: Schema.String,
      releasedById: Schema.String,
      version: Schema.String,
    })
  ),
});

export const staffBugContextRoute = {
  data: StaffBugHistory,
  method: "get",
  operationId: "getWorkspaceBug",
  params: BugIdParams,
  path: "/api/v1/workspace/bugs/{bugId}",
  summary: "A bug's full staff history, with its client context.",
} as const satisfies RouteDefinition;

const BugApprovalStatus = Schema.Literals(["pending", "approved", "rejected"]);

export const StaffBugApprovalInbox = Schema.Struct({
  items: Schema.Array(
    Schema.Struct({
      bugTitle: Schema.String,
      id: Uuid,
      projectName: Schema.String,
      reportedBy: Schema.String,
      status: BugApprovalStatus,
    })
  ),
  nextCursor: NextCursorSchema,
});

export const staffBugApprovalInboxRoute = {
  data: StaffBugApprovalInbox,
  method: "get",
  operationId: "listBugApprovals",
  path: "/api/v1/workspace/bug-approvals",
  query: PageQuerySchema,
  summary:
    "The bug approvals with their status, newest first, one page at a time.",
} as const satisfies RouteDefinition;

const WorkspaceApprovalBody = Schema.Struct({
  companyId: Uuid,
  fileIds: Schema.Array(Uuid).check(Schema.isMaxLength(10)),
  message: Schema.String.check(Schema.isMaxLength(2000)),
  taskId: Uuid,
});

const WorkspaceApprovalReceipt = Schema.Struct({
  id: Uuid,
  version: Schema.Number,
});

export const workspaceApprovalRoute = {
  body: WorkspaceApprovalBody,
  data: WorkspaceApprovalReceipt,
  method: "post",
  operationId: "requestWorkspaceApproval",
  path: "/api/v1/workspace/approvals",
  summary:
    "Ask a client company to approve a shared task with its finished files.",
} as const satisfies RouteDefinition;

const StaffPickBody = Schema.Struct({
  expectedVersion: Version,
  priority: Priority,
  severity: Severity,
});

const StaffTriageBody = Schema.Struct({
  assigneeIds: Schema.Array(Uuid).check(Schema.isMaxLength(100)),
  expectedVersion: Version,
  priority: Priority,
  severity: Severity,
});

const StaffReassignBody = Schema.Struct({
  employeeId: Uuid,
  expectedVersion: Version,
});

const StaffRequestInfoBody = Schema.Struct({
  expectedVersion: Version,
  question: Text,
});

const StaffFixAttemptBody = Schema.Struct({
  affectedVersion: ShortText,
  commitUrl: ShortText,
  expectedVersion: Version,
  fixSummary: Text,
  fixedVersion: ShortText,
  pullRequestUrl: ShortText,
  rootCause: Text,
  verificationSteps: Schema.Array(Text).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(30)
  ),
});

const StaffVerificationBody = Schema.Struct({
  attemptId: Uuid,
  expectedVersion: Version,
  notes: Text,
  outcome: Schema.Literals(["passed", "failed"]),
  testedEnvironment: Environment,
  testedVersion: Text,
});

const StaffApprovalBody = Schema.Struct({
  expectedVersion: Version,
  fixAttemptId: Uuid,
});

const StaffApprovalDecisionBody = Schema.Struct({
  approvalId: Uuid,
  comment: Schema.NullOr(Schema.String.check(Schema.isMaxLength(10_000))),
  decision: Schema.Literals(["approved", "rejected"]),
  expectedVersion: Version,
  rejectionReason: Schema.NullOr(Schema.String.check(Schema.isMaxLength(2000))),
});

export const staffBugActionRoutes = {
  approval: {
    body: StaffApprovalBody,
    data: WorkflowReceipt,
    method: "post",
    operationId: "submitBugApproval",
    params: BugIdParams,
    path: "/api/v1/workspace/bugs/{bugId}/approval",
    summary: "Send a verified fix to an admin for approval.",
  },
  approvalDecision: {
    body: StaffApprovalDecisionBody,
    data: WorkflowReceipt,
    method: "post",
    operationId: "decideBugApproval",
    params: BugIdParams,
    path: "/api/v1/workspace/bugs/{bugId}/approval/decision",
    summary: "Approve a fix for release or send it back with a reason.",
  },
  fixAttempt: {
    body: StaffFixAttemptBody,
    data: WorkflowReceipt,
    method: "post",
    operationId: "recordBugFixAttempt",
    params: BugIdParams,
    path: "/api/v1/workspace/bugs/{bugId}/fix-attempts",
    summary: "Record the root cause, the fix and how to verify it.",
  },
  pick: {
    body: StaffPickBody,
    data: WorkflowReceipt,
    method: "post",
    operationId: "pickWorkspaceBug",
    params: BugIdParams,
    path: "/api/v1/workspace/bugs/{bugId}/pick",
    summary:
      "Pick up a client report. Only a designated handler of the client's company may.",
  },
  reassign: {
    body: StaffReassignBody,
    data: WorkflowReceipt,
    method: "post",
    operationId: "reassignWorkspaceBug",
    params: BugIdParams,
    path: "/api/v1/workspace/bugs/{bugId}/reassign",
    summary: "Hand a picked client bug to exactly one employee.",
  },
  requestInfo: {
    body: StaffRequestInfoBody,
    data: WorkflowReceipt,
    method: "post",
    operationId: "requestBugInfo",
    params: BugIdParams,
    path: "/api/v1/workspace/bugs/{bugId}/request-info",
    summary: "Ask the client a question and wait for their answer.",
  },
  triage: {
    body: StaffTriageBody,
    data: WorkflowReceipt,
    method: "post",
    operationId: "triageWorkspaceBug",
    params: BugIdParams,
    path: "/api/v1/workspace/bugs/{bugId}/triage",
    summary: "Set the assignees, priority and severity of a client report.",
  },
  verification: {
    body: StaffVerificationBody,
    data: WorkflowReceipt,
    method: "post",
    operationId: "verifyBugFix",
    params: BugIdParams,
    path: "/api/v1/workspace/bugs/{bugId}/verifications",
    summary: "Say whether a fix attempt passed its verification.",
  },
} as const satisfies Record<string, RouteDefinition>;

const BUG_LIST_MAX_PAGE_SIZE = 100;

// What the caller may do with a bug right now, so the app shows only what the
// services will accept.
export const StaffBugAction = Schema.Literals([
  "comment",
  "reply_to_client",
  "pick",
  "request_info",
]);

export const StaffBugListItem = Schema.Struct({
  clientCompanyName: Schema.NullOr(Schema.String),
  id: Uuid,
  permittedActions: Schema.Array(StaffBugAction),
  priority: Priority,
  reference: Schema.String,
  severity: Severity,
  sla: Schema.NullOr(SlaView),
  status: WorkflowStatus,
  title: Schema.String,
  updatedAt: Schema.String,
  version: Version,
});

export const StaffBugList = Schema.Struct({
  items: Schema.Array(StaffBugListItem),
  nextCursor: Schema.NullOr(Schema.String),
});

export const staffBugListRoute = {
  data: StaffBugList,
  method: "get",
  operationId: "listWorkspaceBugs",
  path: "/api/v1/workspace/bugs",
  query: Schema.Struct({
    cursor: Schema.optional(Schema.String.check(Schema.isMinLength(1))),
    limit: Schema.optional(
      Schema.FiniteFromString.check(
        Schema.isInt(),
        Schema.isBetween({ maximum: BUG_LIST_MAX_PAGE_SIZE, minimum: 1 })
      )
    ),
    status: Schema.optional(WorkflowStatus),
  }),
  summary:
    "The bugs the caller handles or is assigned to (an admin sees all), most recently changed first, one page at a time.",
} as const satisfies RouteDefinition;

export const BUG_LIST_DEFAULT_PAGE_SIZE = 30;

const CommentVisibility = Schema.Literals(["internal", "public"]);

const StaffCommentBody = Schema.Struct({
  body: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(10_000)),
  // "internal" stays with the team; "public" is a reply the client sees.
  visibility: CommentVisibility,
});

export const StaffBugComment = Schema.Struct({
  authorId: Schema.String,
  body: Schema.String,
  bugId: Uuid,
  createdAt: Schema.String,
  id: Uuid,
  visibility: CommentVisibility,
});

export const staffBugCommentRoute = {
  body: StaffCommentBody,
  data: StaffBugComment,
  method: "post",
  operationId: "addWorkspaceBugComment",
  params: BugIdParams,
  path: "/api/v1/workspace/bugs/{bugId}/comments",
  summary:
    "Reply in a bug's discussion, as an internal note or as a reply the client sees.",
} as const satisfies RouteDefinition;

export const bugRoutes = [
  portalBugRoutes.page,
  portalBugRoutes.submit,
  portalBugRoutes.detail,
  portalBugActionRoutes.comment,
  portalBugActionRoutes.confirm,
  portalBugActionRoutes.reopen,
  portalApprovalRoutes.list,
  portalApprovalRoutes.detail,
  portalApprovalRoutes.decide,
  staffBugContextRoute,
  staffBugListRoute,
  staffBugApprovalInboxRoute,
  staffBugCommentRoute,
  workspaceApprovalRoute,
  staffBugActionRoutes.approval,
  staffBugActionRoutes.approvalDecision,
  staffBugActionRoutes.fixAttempt,
  staffBugActionRoutes.pick,
  staffBugActionRoutes.reassign,
  staffBugActionRoutes.requestInfo,
  staffBugActionRoutes.triage,
  staffBugActionRoutes.verification,
] as const satisfies readonly RouteDefinition[];
