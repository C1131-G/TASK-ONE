import { Schema } from "effect";

import { UUIDSchema } from "../core/input-schemas";
import { BrowserContextSchema } from "../portal/portal-browser-context";
import { BugEnvironmentSchema } from "./bug-contracts";
import { BugReportItemSchema } from "./bug-management";
import { SlaViewSchema } from "./bug-management-contracts";

const BugEvidenceHistorySchema = Schema.Struct({
  caption: Schema.String,
  createdAt: Schema.String,
  externalUrl: Schema.NullOr(Schema.String),
  file: Schema.NullOr(
    Schema.Struct({
      contentType: Schema.NullOr(Schema.String),
      id: UUIDSchema,
      name: Schema.String,
      sizeBytes: Schema.Number,
    })
  ),
  id: UUIDSchema,
  kind: Schema.Literals(["before", "after", "other"]),
  uploadedBy: Schema.Struct({ id: Schema.String, name: Schema.String }),
});

const BugAttemptHistorySchema = Schema.Struct({
  affectedVersion: Schema.NullOr(Schema.String),
  authorId: Schema.String,
  commitUrl: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  fixSummary: Schema.String,
  fixedVersion: Schema.NullOr(Schema.String),
  id: UUIDSchema,
  pullRequestUrl: Schema.NullOr(Schema.String),
  rootCause: Schema.String,
  testedEnvironment: Schema.NullOr(BugEnvironmentSchema),
  testedVersion: Schema.NullOr(Schema.String),
  verificationNotes: Schema.NullOr(Schema.String),
  verificationOutcome: Schema.NullOr(Schema.Literals(["passed", "failed"])),
  verificationSteps: Schema.Array(Schema.String),
  verifiedAt: Schema.NullOr(Schema.String),
  verifiedById: Schema.NullOr(Schema.String),
});

export const BugHistorySchema = Schema.Struct({
  approvals: Schema.Array(
    Schema.Struct({
      comment: Schema.NullOr(Schema.String),
      decidedAt: Schema.NullOr(Schema.String),
      decidedById: Schema.NullOr(Schema.String),
      id: UUIDSchema,
      rejectionReason: Schema.NullOr(Schema.String),
      snapshot: Schema.Json,
      status: Schema.Literals(["pending", "approved", "rejected"]),
      submittedAt: Schema.String,
      submittedById: Schema.String,
    })
  ),
  archived: Schema.Boolean,
  assignees: Schema.Array(
    Schema.Struct({ id: Schema.String, name: Schema.String })
  ),
  attempts: Schema.Array(BugAttemptHistorySchema),
  bug: BugReportItemSchema,
  // What the reporter's browser volunteered with the report; staff only.
  clientContext: Schema.NullOr(BrowserContextSchema),
  // Set for client reports: who they came from and who has picked them up.
  clientReport: Schema.NullOr(
    Schema.Struct({
      awaitingClientSince: Schema.NullOr(Schema.String),
      canAskClient: Schema.Boolean,
      canCloseNotABug: Schema.Boolean,
      canPick: Schema.Boolean,
      companyId: UUIDSchema,
      companyName: Schema.String,
      needsInfoSince: Schema.NullOr(Schema.String),
      pickedAt: Schema.NullOr(Schema.String),
      pickedByName: Schema.NullOr(Schema.String),
      reopenCount: Schema.Number,
      resolution: Schema.NullOr(Schema.String),
      satisfaction: Schema.NullOr(Schema.Literals(["up", "down"])),
      satisfactionComment: Schema.NullOr(Schema.String),
      sla: Schema.NullOr(SlaViewSchema),
    })
  ),
  evidence: Schema.Array(BugEvidenceHistorySchema),
  priority: Schema.Literals(["urgent", "high", "medium", "low", "none"]),
  relations: Schema.Array(
    Schema.Struct({
      bug: BugReportItemSchema,
      type: Schema.Literals(["duplicate", "recurrence"]),
    })
  ),
  releases: Schema.Array(
    Schema.Struct({
      checkedAt: Schema.NullOr(Schema.String),
      environment: BugEnvironmentSchema,
      id: UUIDSchema,
      postReleaseCheckNotes: Schema.NullOr(Schema.String),
      postReleaseCheckPassed: Schema.Boolean,
      releasedAt: Schema.String,
      releasedById: Schema.String,
      version: Schema.String,
    })
  ),
});
