import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import { BugHistory, BugHistoryLive } from "../../src/server/work/bug-history";
import {
  BugManagement,
  BugManagementLive,
} from "../../src/server/work/bug-management";
import {
  BugWorkflowManagement,
  BugWorkflowManagementLive,
} from "../../src/server/work/bug-workflow-management";
import {
  removeLifecycleRecords,
  seedLifecycleRecords,
} from "./support/bug-lifecycle-records";
import type { LifecycleIds } from "./support/bug-lifecycle-records";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

interface VerifiedFix {
  readonly attemptId: string;
  readonly version: number;
}

const reportAndTriage = ({ adminId, employeeId, projectId }: LifecycleIds) =>
  Effect.gen(function* reportAndTriageProgram() {
    const bugs = yield* BugManagement;
    const workflow = yield* BugWorkflowManagement;
    const report = yield* bugs.reportBug(employeeId, {
      actualBehavior: "The save request returns an error.",
      appVersion: "3.0.0",
      browser: "Firefox",
      component: "ProjectForm",
      description: null,
      device: "Desktop",
      discoverySource: "internal_qa",
      environment: "staging",
      expectedBehavior: "The project is saved.",
      os: "Windows",
      projectId,
      reproductionSteps: ["Open settings", "Save the form"],
      route: "/projects/settings",
      severity: "major",
      title: "Project form fails to save",
    });
    const triage = yield* workflow.triage(adminId, {
      assigneeIds: [employeeId],
      bugId: report.id,
      expectedVersion: report.version,
      priority: "high",
      severity: "critical",
    });
    return { report, triage };
  });

const latestAttemptId = (
  employeeId: string,
  bugId: string,
  missingMessage: string
) =>
  Effect.gen(function* latestAttemptIdProgram() {
    const history = yield* BugHistory;
    const attempt = (yield* history.get(employeeId, bugId)).attempts.at(-1);
    if (!attempt) {
      throw new Error(missingMessage);
    }
    return attempt.id;
  });

// The first fix fails verification and the second one passes.
const failThenPassFix = (employeeId: string, bugId: string, version: number) =>
  Effect.gen(function* failThenPassFixProgram() {
    const workflow = yield* BugWorkflowManagement;
    const before = yield* workflow.addEvidence(employeeId, {
      bugId,
      caption: "Failure before the fix",
      expectedVersion: version,
      externalUrl: "https://evidence.example/before",
      fileAssetId: null,
      fixAttemptId: null,
      kind: "before",
    });
    const firstAttempt = yield* workflow.addFixAttempt(employeeId, {
      affectedVersion: "3.0.0",
      bugId,
      commitUrl: null,
      expectedVersion: before.version,
      fixSummary: "Try the first empty-response handling approach.",
      fixedVersion: null,
      pullRequestUrl: null,
      rootCause: "The response handling was incomplete.",
      verificationSteps: ["Submit the settings form", "Reload the project"],
    });
    const firstAttemptId = yield* latestAttemptId(
      employeeId,
      bugId,
      "The fix attempt was not returned in history."
    );
    const failedVerification = yield* workflow.verifyFix(employeeId, {
      attemptId: firstAttemptId,
      bugId,
      expectedVersion: firstAttempt.version,
      notes: "The first approach still fails on empty data.",
      outcome: "failed",
      testedEnvironment: "staging",
      testedVersion: "3.0.0-rc1",
    });
    const secondAttempt = yield* workflow.addFixAttempt(employeeId, {
      affectedVersion: "3.0.0",
      bugId,
      commitUrl: "https://github.com/example/app/commit/abc123",
      expectedVersion: failedVerification.version,
      fixSummary: "Handle the empty project response.",
      fixedVersion: "3.0.1",
      pullRequestUrl: "https://github.com/example/app/pull/42",
      rootCause: "The form did not handle an empty project response.",
      verificationSteps: ["Submit the settings form", "Reload the project"],
    });
    const attemptId = yield* latestAttemptId(
      employeeId,
      bugId,
      "The follow-up fix attempt was not returned in history."
    );
    const verification = yield* workflow.verifyFix(employeeId, {
      attemptId,
      bugId,
      expectedVersion: secondAttempt.version,
      notes: "The form saved and reloaded correctly.",
      outcome: "passed",
      testedEnvironment: "staging",
      testedVersion: "3.0.1-rc1",
    });
    return { attemptId, version: verification.version } satisfies VerifiedFix;
  });

// Submitting without after-evidence must fail; with it the fix is approved, released and closed.
const approveReleaseAndClose = (
  { adminId, employeeId }: LifecycleIds,
  bugId: string,
  fix: VerifiedFix
) =>
  Effect.gen(function* approveReleaseAndCloseProgram() {
    const workflow = yield* BugWorkflowManagement;
    const history = yield* BugHistory;
    const missingEvidenceSubmission = yield* Effect.exit(
      workflow.submitApproval(employeeId, {
        bugId,
        expectedVersion: fix.version,
        fixAttemptId: fix.attemptId,
      })
    );
    const after = yield* workflow.addEvidence(employeeId, {
      bugId,
      caption: "Saved project after the fix",
      expectedVersion: fix.version,
      externalUrl: "https://evidence.example/after",
      fileAssetId: null,
      fixAttemptId: fix.attemptId,
      kind: "after",
    });
    const submitted = yield* workflow.submitApproval(employeeId, {
      bugId,
      expectedVersion: after.version,
      fixAttemptId: fix.attemptId,
    });
    const approval = (yield* history.get(employeeId, bugId)).approvals.at(-1);
    if (!approval) {
      throw new Error("The approval submission was not returned in history.");
    }
    const decided = yield* workflow.decideApproval(adminId, {
      approvalId: approval.id,
      comment: "Reviewed the fix and evidence.",
      decision: "approved",
      expectedVersion: submitted.version,
      rejectionReason: null,
    });
    const released = yield* workflow.recordRelease(adminId, {
      approvalId: approval.id,
      bugId,
      environment: "production",
      expectedVersion: decided.version,
      notes: null,
      version: "3.0.1",
    });
    const release = (yield* history.get(employeeId, bugId)).releases.at(-1);
    if (!release) {
      throw new Error("The release was not returned in history.");
    }
    const closed = yield* workflow.postReleaseCheck(adminId, {
      bugId,
      expectedVersion: released.version,
      notes: "The production flow passes.",
      passed: true,
      releaseId: release.id,
    });
    return { closed, missingEvidenceSubmission };
  });

it("completes report, evidence, verification, approval, release, and closure with immutable history", async () => {
  const ids: LifecycleIds = {
    adminId: randomUUID(),
    employeeId: randomUUID(),
    projectId: randomUUID(),
  };
  await seedLifecycleRecords(ids);

  let taskId: string | null = null;
  let bugId: string | null = null;
  try {
    const outcome = await Effect.runPromise(
      Effect.gen(function* completeLifecycle() {
        const history = yield* BugHistory;
        const { report, triage } = yield* reportAndTriage(ids);
        ({ id: bugId, taskId } = report);
        const fix = yield* failThenPassFix(
          ids.employeeId,
          report.id,
          triage.version
        );
        const { closed, missingEvidenceSubmission } =
          yield* approveReleaseAndClose(ids, report.id, fix);
        return {
          closed,
          history: yield* history.get(ids.employeeId, report.id),
          missingEvidenceSubmission,
          triage,
        };
      }).pipe(
        Effect.provide(BugManagementLive),
        Effect.provide(BugWorkflowManagementLive),
        Effect.provide(BugHistoryLive)
      )
    );

    expect(outcome.triage.status).toBe("triaged");
    expect(outcome.closed.status).toBe("closed");
    expect(outcome.missingEvidenceSubmission._tag).toBe("Failure");
    expect(outcome.history.approvals).toHaveLength(1);
    expect(outcome.history.approvals[0]).toMatchObject({ status: "approved" });
    expect(outcome.history.attempts[0]).toMatchObject({
      verificationOutcome: "failed",
    });
    expect(outcome.history.attempts[1]).toMatchObject({
      commitUrl: "https://github.com/example/app/commit/abc123",
      fixedVersion: "3.0.1",
      pullRequestUrl: "https://github.com/example/app/pull/42",
      verificationOutcome: "passed",
      verifiedById: ids.employeeId,
    });
    expect(outcome.history.evidence.map(({ kind }) => kind)).toEqual([
      "before",
      "after",
    ]);
    expect(outcome.history.releases[0]).toMatchObject({
      environment: "production",
      postReleaseCheckPassed: true,
      version: "3.0.1",
    });
  } finally {
    await removeLifecycleRecords(ids, taskId, bugId);
  }
});

// A client report takes the same internal path, but a passing post-release
// check hands it to the client to verify instead of closing it.
it("hands a released client report to the client instead of closing it", async () => {
  const ids: LifecycleIds = {
    adminId: randomUUID(),
    employeeId: randomUUID(),
    projectId: randomUUID(),
  };
  await seedLifecycleRecords(ids);
  const companyId = randomUUID();
  await authPool.query(
    'INSERT INTO client_company (id, name, "createdById") VALUES ($1, $2, $3)',
    [companyId, `Lifecycle client ${companyId}`, ids.adminId]
  );

  let taskId: string | null = null;
  let bugId: string | null = null;
  try {
    const outcome = await Effect.runPromise(
      Effect.gen(function* clientLifecycle() {
        const { report, triage } = yield* reportAndTriage(ids);
        ({ id: bugId, taskId } = report);
        yield* Effect.promise(() =>
          authPool.query(
            'UPDATE bug_report SET "clientCompanyId" = $2, "clientImpact" = \'high\' WHERE id = $1',
            [report.id, companyId]
          )
        );
        const fix = yield* failThenPassFix(
          ids.employeeId,
          report.id,
          triage.version
        );
        const { closed } = yield* approveReleaseAndClose(ids, report.id, fix);
        return closed;
      }).pipe(
        Effect.provide(BugManagementLive),
        Effect.provide(BugWorkflowManagementLive),
        Effect.provide(BugHistoryLive)
      )
    );

    expect(outcome.status).toBe("awaiting_client");
    const row = await authPool.query<{ awaitingClientSince: Date | null }>(
      'SELECT "awaitingClientSince" FROM bug_report WHERE id = $1',
      [bugId]
    );
    expect(row.rows[0]?.awaitingClientSince).not.toBeNull();
  } finally {
    // Handing the bug to the client schedules its 7-day auto-close.
    await authPool.query("DELETE FROM job WHERE payload->>'bugId' = $1", [
      bugId,
    ]);
    // The company points at the admin, so it goes before the seeded users.
    await authPool.query(
      'UPDATE bug_report SET "clientCompanyId" = NULL WHERE "clientCompanyId" = $1',
      [companyId]
    );
    await authPool.query("DELETE FROM client_company WHERE id = $1", [
      companyId,
    ]);
    await removeLifecycleRecords(ids, taskId, bugId);
  }
});
