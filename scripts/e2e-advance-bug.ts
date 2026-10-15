import "dotenv/config";
import { Effect } from "effect";

import { authPool } from "../src/server/auth/database";
import { BugHistory, BugHistoryLive } from "../src/server/work/bug-history";
import {
  BugWorkflowManagement,
  BugWorkflowManagementLive,
} from "../src/server/work/bug-workflow-management";

// Moves a client bug from triaged through a verified fix, approval, release
// and a passing post-release check, using the real workflow. The E2E portal
// spec calls it in place of clicking through the internal fix pages.
//
// Usage: bun scripts/e2e-advance-bug.ts "<exact bug title>"
// The assignee does the engineering steps; ui-admin@metsys.test approves and
// releases.

const title = process.argv.at(2);
if (!title) {
  throw new Error("Pass the bug title.");
}

const found = await authPool.query<{
  assigneeId: string | null;
  bugId: string;
  version: number;
}>(
  `SELECT b.id AS "bugId", b.version, a."userId" AS "assigneeId"
     FROM bug_report b
     JOIN task t ON t.id = b."taskId"
     LEFT JOIN task_assignee a ON a."taskId" = t.id
    WHERE t.title = $1
    ORDER BY b."createdAt" DESC
    LIMIT 1`,
  [title]
);
const admin = await authPool.query<{ id: string }>(
  'SELECT id FROM "user" WHERE "emailNormalized" = \'ui-admin@metsys.test\''
);
const [bug] = found.rows;
const adminId = admin.rows[0]?.id;
if (!(bug?.assigneeId && adminId)) {
  throw new Error("The bug must exist and be picked, and ui-admin must exist.");
}
const { assigneeId, bugId } = bug;

const advance = Effect.gen(function* advanceBug() {
  const workflow = yield* BugWorkflowManagement;
  const history = yield* BugHistory;
  const before = yield* workflow.addEvidence(assigneeId, {
    bugId,
    caption: "Reproduced before the fix",
    expectedVersion: bug.version,
    externalUrl: "https://evidence.example/before",
    fileAssetId: null,
    fixAttemptId: null,
    kind: "before",
  });
  const attempt = yield* workflow.addFixAttempt(assigneeId, {
    affectedVersion: "1.0.0",
    bugId,
    commitUrl: null,
    expectedVersion: before.version,
    fixSummary: "Handle the failing export.",
    fixedVersion: "1.0.1",
    pullRequestUrl: null,
    rootCause: "The export did not handle empty rows.",
    verificationSteps: ["Export invoices"],
  });
  const attemptId = (yield* history.get(assigneeId, bugId)).attempts.at(-1)?.id;
  if (!attemptId) {
    throw new Error("The fix attempt is missing.");
  }
  const verified = yield* workflow.verifyFix(assigneeId, {
    attemptId,
    bugId,
    expectedVersion: attempt.version,
    notes: "Works on staging.",
    outcome: "passed",
    testedEnvironment: "staging",
    testedVersion: "1.0.1-rc1",
  });
  const after = yield* workflow.addEvidence(assigneeId, {
    bugId,
    caption: "Export works after the fix",
    expectedVersion: verified.version,
    externalUrl: "https://evidence.example/after",
    fileAssetId: null,
    fixAttemptId: attemptId,
    kind: "after",
  });
  const submitted = yield* workflow.submitApproval(assigneeId, {
    bugId,
    expectedVersion: after.version,
    fixAttemptId: attemptId,
  });
  const approvalId = (yield* history.get(assigneeId, bugId)).approvals.at(
    -1
  )?.id;
  if (!approvalId) {
    throw new Error("The approval is missing.");
  }
  const decided = yield* workflow.decideApproval(adminId, {
    approvalId,
    comment: "Approved.",
    decision: "approved",
    expectedVersion: submitted.version,
    rejectionReason: null,
  });
  const released = yield* workflow.recordRelease(adminId, {
    approvalId,
    bugId,
    environment: "production",
    expectedVersion: decided.version,
    notes: null,
    version: "1.0.1",
  });
  const releaseId = (yield* history.get(assigneeId, bugId)).releases.at(-1)?.id;
  if (!releaseId) {
    throw new Error("The release is missing.");
  }
  return yield* workflow.postReleaseCheck(adminId, {
    bugId,
    expectedVersion: released.version,
    notes: "Production export works.",
    passed: true,
    releaseId,
  });
});

const result = await Effect.runPromise(
  advance.pipe(
    Effect.provide(BugWorkflowManagementLive),
    Effect.provide(BugHistoryLive)
  )
);
process.stdout.write(`${result.status}\n`);
await authPool.end();
