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

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

it("completes report, evidence, verification, approval, release, and closure with immutable history", async () => {
  const adminId = randomUUID();
  const employeeId = randomUUID();
  const projectId = randomUUID();
  const suffix = randomUUID();
  const projectKey = `L${suffix.slice(0, 6)}`;
  const adminEmail = `${adminId}@bug-lifecycle.example`;
  const employeeEmail = `${employeeId}@bug-lifecycle.example`;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'admin\', false), ($4, $5, $6, $6, \'employee\', false)',
    [
      adminId,
      "Lifecycle Admin",
      adminEmail,
      employeeId,
      "Lifecycle Reporter",
      employeeEmail,
    ]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, projectKey, "Bug lifecycle test"]
  );

  let taskId: string | null = null;
  let bugId: string | null = null;
  try {
    const outcome = await Effect.runPromise(
      Effect.gen(function* completeLifecycle() {
        const bugs = yield* BugManagement;
        const workflow = yield* BugWorkflowManagement;
        const history = yield* BugHistory;
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
        const {
          id: reportedBugId,
          taskId: reportedTaskId,
          version: reportedVersion,
        } = report;
        taskId = reportedTaskId;
        bugId = reportedBugId;

        const triage = yield* workflow.triage(adminId, {
          assigneeIds: [employeeId],
          bugId: reportedBugId,
          expectedVersion: reportedVersion,
          priority: "high",
          severity: "critical",
        });
        const before = yield* workflow.addEvidence(employeeId, {
          bugId: reportedBugId,
          caption: "Failure before the fix",
          expectedVersion: triage.version,
          externalUrl: "https://evidence.example/before",
          fileAssetId: null,
          fixAttemptId: null,
          kind: "before",
        });
        const firstAttempt = yield* workflow.addFixAttempt(employeeId, {
          affectedVersion: "3.0.0",
          bugId: reportedBugId,
          commitUrl: null,
          expectedVersion: before.version,
          fixSummary: "Try the first empty-response handling approach.",
          fixedVersion: null,
          pullRequestUrl: null,
          rootCause: "The response handling was incomplete.",
          verificationSteps: ["Submit the settings form", "Reload the project"],
        });
        const attemptHistory = yield* history.get(employeeId, reportedBugId);
        const firstAttemptRecord = attemptHistory.attempts.at(-1);
        if (!firstAttemptRecord) {
          throw new Error("The fix attempt was not returned in history.");
        }
        const failedVerification = yield* workflow.verifyFix(employeeId, {
          attemptId: firstAttemptRecord.id,
          bugId: reportedBugId,
          expectedVersion: firstAttempt.version,
          notes: "The first approach still fails on empty data.",
          outcome: "failed",
          testedEnvironment: "staging",
          testedVersion: "3.0.0-rc1",
        });
        const secondAttempt = yield* workflow.addFixAttempt(employeeId, {
          affectedVersion: "3.0.0",
          bugId: reportedBugId,
          commitUrl: "https://github.com/example/app/commit/abc123",
          expectedVersion: failedVerification.version,
          fixSummary: "Handle the empty project response.",
          fixedVersion: "3.0.1",
          pullRequestUrl: "https://github.com/example/app/pull/42",
          rootCause: "The form did not handle an empty project response.",
          verificationSteps: ["Submit the settings form", "Reload the project"],
        });
        const secondAttemptHistory = yield* history.get(
          employeeId,
          reportedBugId
        );
        const latestAttempt = secondAttemptHistory.attempts.at(-1);
        if (!latestAttempt) {
          throw new Error(
            "The follow-up fix attempt was not returned in history."
          );
        }
        const verification = yield* workflow.verifyFix(employeeId, {
          attemptId: latestAttempt.id,
          bugId: reportedBugId,
          expectedVersion: secondAttempt.version,
          notes: "The form saved and reloaded correctly.",
          outcome: "passed",
          testedEnvironment: "staging",
          testedVersion: "3.0.1-rc1",
        });
        const missingEvidenceSubmission = yield* Effect.exit(
          workflow.submitApproval(employeeId, {
            bugId: reportedBugId,
            expectedVersion: verification.version,
            fixAttemptId: latestAttempt.id,
          })
        );
        const after = yield* workflow.addEvidence(employeeId, {
          bugId: reportedBugId,
          caption: "Saved project after the fix",
          expectedVersion: verification.version,
          externalUrl: "https://evidence.example/after",
          fileAssetId: null,
          fixAttemptId: latestAttempt.id,
          kind: "after",
        });
        const submitted = yield* workflow.submitApproval(employeeId, {
          bugId: reportedBugId,
          expectedVersion: after.version,
          fixAttemptId: latestAttempt.id,
        });
        const submittedHistory = yield* history.get(employeeId, reportedBugId);
        const approval = submittedHistory.approvals.at(-1);
        if (!approval) {
          throw new Error(
            "The approval submission was not returned in history."
          );
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
          bugId: reportedBugId,
          environment: "production",
          expectedVersion: decided.version,
          notes: null,
          version: "3.0.1",
        });
        const releasedHistory = yield* history.get(employeeId, reportedBugId);
        const release = releasedHistory.releases.at(-1);
        if (!release) {
          throw new Error("The release was not returned in history.");
        }
        const closed = yield* workflow.postReleaseCheck(adminId, {
          bugId: reportedBugId,
          expectedVersion: released.version,
          notes: "The production flow passes.",
          passed: true,
          releaseId: release.id,
        });
        return {
          closed,
          history: yield* history.get(employeeId, reportedBugId),
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
      verifiedById: employeeId,
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
    if (taskId) {
      await authPool.query(
        'DELETE FROM job WHERE "dedupeKey" IN (SELECT \'push:\' || id::text FROM notification WHERE "taskId" = $1)',
        [taskId]
      );
      await authPool.query('DELETE FROM notification WHERE "taskId" = $1', [
        taskId,
      ]);
      await authPool.query('DELETE FROM activity WHERE "taskId" = $1', [
        taskId,
      ]);
      await authPool.query('DELETE FROM bug_release WHERE "bugReportId" = $1', [
        bugId,
      ]);
      await authPool.query(
        'DELETE FROM bug_approval WHERE "bugReportId" = $1',
        [bugId]
      );
      await authPool.query(
        'DELETE FROM bug_evidence WHERE "bugReportId" = $1',
        [bugId]
      );
      await authPool.query(
        'DELETE FROM bug_fix_attempt WHERE "bugReportId" = $1',
        [bugId]
      );
      await authPool.query(
        'DELETE FROM bug_relation WHERE "fromBugReportId" = $1 OR "toBugReportId" = $1',
        [bugId]
      );
      await authPool.query("DELETE FROM bug_report WHERE id = $1", [bugId]);
      await authPool.query('DELETE FROM "task_assignee" WHERE "taskId" = $1', [
        taskId,
      ]);
      await authPool.query("DELETE FROM task WHERE id = $1", [taskId]);
    }
    await authPool.query('DELETE FROM activity WHERE "projectId" = $1', [
      projectId,
    ]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id IN ($1, $2)', [
      adminId,
      employeeId,
    ]);
  }
});
