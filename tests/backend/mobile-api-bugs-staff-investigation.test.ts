import { afterAll, beforeAll, expect, it } from "bun:test";

import { Effect, Schema } from "effect";

import {
  authPool,
  ids,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import {
  bugRow,
  forceStatus,
  linkProjectToCompanies,
  reportBody,
  send,
  setHandlers,
  statusOf,
  versionOf,
} from "./support/mobile-bugs-fixtures";

beforeAll(async () => {
  await setupHarness();
  await linkProjectToCompanies();
  await setHandlers(ids.clientCompanyId, ["owner"]);
});
afterAll(teardownHarness);

const submitRoute = () => import("../../app/api/v1/portal/bugs/route");
const triageRoute = () =>
  import("../../app/api/v1/workspace/bugs/[bugId]/triage/route");
const fixAttemptRoute = () =>
  import("../../app/api/v1/workspace/bugs/[bugId]/fix-attempts/route");
const verificationRoute = () =>
  import("../../app/api/v1/workspace/bugs/[bugId]/verifications/route");

interface AttemptRow {
  readonly affectedVersion: string | null;
  readonly authorId: string;
  readonly commitUrl: string | null;
  readonly fixSummary: string;
  readonly fixedVersion: string | null;
  readonly id: string;
  readonly pullRequestUrl: string | null;
  readonly rootCause: string;
  readonly testedEnvironment: string | null;
  readonly testedVersion: string | null;
  readonly verificationNotes: string | null;
  readonly verificationOutcome: string | null;
  readonly verificationSteps: string[];
  readonly verifiedAt: Date | null;
  readonly verifiedById: string | null;
}

const attemptsOf = async (bugId: string): Promise<AttemptRow[]> => {
  const result = await authPool.query<AttemptRow>(
    `SELECT "affectedVersion", "authorId", "commitUrl", "fixSummary",
            "fixedVersion", id, "pullRequestUrl", "rootCause",
            "testedEnvironment", "testedVersion", "verificationNotes",
            "verificationOutcome", "verificationSteps", "verifiedAt",
            "verifiedById"
     FROM bug_fix_attempt
     WHERE "bugReportId" = $1
     ORDER BY "createdAt"`,
    [bugId]
  );
  return result.rows;
};

const submit = async (title: string): Promise<string> => {
  const { POST } = await submitRoute();
  const reply = await send(POST, "POST", "client", { body: reportBody(title) });
  if (reply.status !== 200) {
    throw new Error(JSON.stringify(reply.body));
  }
  return reply.body.data.bugId as string;
};

// A client report moved to triaged, with the owner as its only assignee.
const triagedBug = async (title: string): Promise<string> => {
  const bugId = await submit(title);
  const { POST } = await triageRoute();
  const reply = await send(POST, "POST", "admin", {
    body: {
      assigneeIds: [personaId("owner")],
      expectedVersion: await versionOf(bugId),
      priority: "high",
      severity: "major",
    },
    params: { bugId },
  });
  if (reply.status !== 200) {
    throw new Error(JSON.stringify(reply.body));
  }
  return bugId;
};

// An internal bug has no company, and its reporter is the employee below.
const internalBug = async (title: string): Promise<string> => {
  const { BugManagement, BugManagementLive } =
    await import("../../src/server/work/bug-management");
  const bug = await Effect.runPromise(
    Effect.provide(
      Effect.gen(function* reportInternal() {
        const bugs = yield* BugManagement;
        return yield* bugs.reportBug(personaId("owner"), {
          actualBehavior: "The dialog hangs.",
          appVersion: null,
          browser: null,
          component: "SettingsDialog",
          description: null,
          device: null,
          discoverySource: "internal_qa",
          environment: "staging",
          expectedBehavior: "The dialog closes.",
          os: null,
          projectId: ids.projectId,
          reproductionSteps: ["Open settings"],
          route: "/settings",
          severity: "minor",
          title,
        });
      }),
      BugManagementLive
    )
  );
  return bug.id;
};

const attemptBody = (expectedVersion: number) => ({
  affectedVersion: "1.2.0",
  commitUrl: null,
  expectedVersion,
  fixSummary: "Guard the empty state.",
  fixedVersion: "1.3.0",
  pullRequestUrl: "https://example.com/pr/42",
  rootCause: "The list assumed at least one row.",
  verificationSteps: ["Open the empty list", "Reload"],
});

const verificationBody = (
  attemptId: string,
  expectedVersion: number,
  outcome: "passed" | "failed" = "passed"
) => ({
  attemptId,
  expectedVersion,
  notes: "Looked right on staging.",
  outcome,
  testedEnvironment: "staging",
  testedVersion: "1.3.0",
});

const addAttempt = async (
  bugId: string,
  persona: "admin" | "owner"
): Promise<AttemptRow> => {
  const { POST } = await fixAttemptRoute();
  const reply = await send(POST, "POST", persona, {
    body: attemptBody(await versionOf(bugId)),
    params: { bugId },
  });
  if (reply.status !== 200) {
    throw new Error(JSON.stringify(reply.body));
  }
  const [attempt] = await attemptsOf(bugId);
  if (!attempt) {
    throw new Error("attempt missing");
  }
  return attempt;
};

it("lets an admin, the assignee and the reporter record fix attempts", async () => {
  const adminBug = await triagedBug("Admin attempt");
  const adminVersion = await versionOf(adminBug);
  const { POST } = await fixAttemptRoute();

  const adminReply = await send(POST, "POST", "admin", {
    body: attemptBody(adminVersion),
    params: { bugId: adminBug },
  });

  expect(adminReply.status).toBe(200);
  expect(adminReply.body.data).toEqual({
    bugId: adminBug,
    status: "in_progress",
    version: adminVersion + 1,
  });
  expect(await attemptsOf(adminBug)).toEqual([
    expect.objectContaining({
      affectedVersion: "1.2.0",
      authorId: personaId("admin"),
      commitUrl: null,
      fixSummary: "Guard the empty state.",
      fixedVersion: "1.3.0",
      pullRequestUrl: "https://example.com/pr/42",
      rootCause: "The list assumed at least one row.",
      verificationSteps: ["Open the empty list", "Reload"],
    }),
  ]);

  const assigneeBug = await triagedBug("Assignee attempt");
  const assigneeReply = await send(POST, "POST", "owner", {
    body: attemptBody(await versionOf(assigneeBug)),
    params: { bugId: assigneeBug },
  });

  expect(assigneeReply.status).toBe(200);
  const [assigneeAttempt] = await attemptsOf(assigneeBug);
  expect(assigneeAttempt?.authorId).toBe(personaId("owner"));

  const reporterBug = await internalBug("Reporter attempt");
  await forceStatus(reporterBug, "triaged");
  const reporterReply = await send(POST, "POST", "owner", {
    body: attemptBody(await versionOf(reporterBug)),
    params: { bugId: reporterBug },
  });

  expect(reporterReply.status).toBe(200);
  const [reporterAttempt] = await attemptsOf(reporterBug);
  expect(reporterAttempt?.authorId).toBe(personaId("owner"));
});

it("answers a stale attempt with a conflict and creates nothing", async () => {
  const bugId = await triagedBug("Stale attempt");
  const before = await bugRow(bugId);
  const { POST } = await fixAttemptRoute();

  const reply = await send(POST, "POST", "admin", {
    body: attemptBody(before.version + 5),
    params: { bugId },
  });

  expect(reply.status).toBe(409);
  expect(await bugRow(bugId)).toEqual(before);
  expect(await attemptsOf(bugId)).toHaveLength(0);
});

it("refuses an attempt from an outsider, a client, a closed, an archived and a reported bug", async () => {
  const bugId = await triagedBug("Attempt permissions");
  const version = await versionOf(bugId);
  const reportedBug = await submit("Attempt too early");
  const closedBug = await triagedBug("Attempt closed");
  await forceStatus(closedBug, "closed");
  const archivedBug = await triagedBug("Attempt archived");
  const archivedRow = await bugRow(archivedBug);
  await authPool.query(
    'UPDATE task SET "archivedAt" = now(), "archivedById" = "createdById" WHERE id = $1',
    [archivedRow.taskId]
  );
  const { POST } = await fixAttemptRoute();

  const outsider = await send(POST, "POST", "outsider", {
    body: attemptBody(version),
    params: { bugId },
  });
  const client = await send(POST, "POST", "client", {
    body: attemptBody(version),
    params: { bugId },
  });
  const closed = await send(POST, "POST", "admin", {
    body: attemptBody(await versionOf(closedBug)),
    params: { bugId: closedBug },
  });
  const archived = await send(POST, "POST", "admin", {
    body: attemptBody(await versionOf(archivedBug)),
    params: { bugId: archivedBug },
  });
  const early = await send(POST, "POST", "admin", {
    body: attemptBody(await versionOf(reportedBug)),
    params: { bugId: reportedBug },
  });

  expect(outsider.status).toBe(403);
  expect(client.status).toBe(403);
  expect(closed.status).toBe(403);
  expect(archived.status).toBe(403);
  expect(early.status).toBe(422);
  expect(await attemptsOf(bugId)).toHaveLength(0);
  expect(await statusOf(reportedBug)).toBe("reported");
  expect(await statusOf(closedBug)).toBe("closed");
});

it("records a passing verification and moves the bug to in_verification", async () => {
  const bugId = await triagedBug("Passing verification");
  const attempt = await addAttempt(bugId, "admin");
  const version = await versionOf(bugId);
  const { POST } = await verificationRoute();

  const reply = await send(POST, "POST", "admin", {
    body: verificationBody(attempt.id, version, "passed"),
    params: { bugId },
  });

  expect(reply.status).toBe(200);
  expect(reply.body.data).toEqual({
    bugId,
    status: "in_verification",
    version: version + 1,
  });
  const [stored] = await attemptsOf(bugId);
  expect(stored).toMatchObject({
    testedEnvironment: "staging",
    testedVersion: "1.3.0",
    verificationNotes: "Looked right on staging.",
    verificationOutcome: "passed",
    verifiedById: personaId("admin"),
  });
  expect(stored?.verifiedAt).not.toBeNull();
});

it("returns to in_progress when a verification fails and refuses a second one", async () => {
  const bugId = await triagedBug("Failing verification");
  const attempt = await addAttempt(bugId, "owner");
  const version = await versionOf(bugId);
  const { POST } = await verificationRoute();

  const failed = await send(POST, "POST", "owner", {
    body: verificationBody(attempt.id, version, "failed"),
    params: { bugId },
  });

  expect(failed.status).toBe(200);
  expect(failed.body.data).toEqual({
    bugId,
    status: "in_progress",
    version: version + 1,
  });
  const failedRow = await attemptsOf(bugId);
  expect(failedRow[0]).toMatchObject({
    testedEnvironment: "staging",
    testedVersion: "1.3.0",
    verificationOutcome: "failed",
  });

  const again = await send(POST, "POST", "owner", {
    body: verificationBody(attempt.id, await versionOf(bugId), "passed"),
    params: { bugId },
  });

  expect(again.status).toBe(409);
  expect(await statusOf(bugId)).toBe("in_progress");
  const afterRetry = await attemptsOf(bugId);
  expect(afterRetry[0]?.verificationOutcome).toBe("failed");
});

it("refuses a verification from an outsider or on a stale version, leaving the attempt unchanged", async () => {
  const bugId = await triagedBug("Verification permissions");
  const attempt = await addAttempt(bugId, "admin");
  const before = await bugRow(bugId);
  const attemptBefore = await attemptsOf(bugId);
  const { POST } = await verificationRoute();

  const outsider = await send(POST, "POST", "outsider", {
    body: verificationBody(attempt.id, before.version, "passed"),
    params: { bugId },
  });
  const client = await send(POST, "POST", "client", {
    body: verificationBody(attempt.id, before.version, "passed"),
    params: { bugId },
  });
  const stale = await send(POST, "POST", "admin", {
    body: verificationBody(attempt.id, before.version + 5, "passed"),
    params: { bugId },
  });

  expect(outsider.status).toBe(403);
  expect(client.status).toBe(403);
  expect(stale.status).toBe(409);
  expect(await bugRow(bugId)).toEqual(before);
  expect(await attemptsOf(bugId)).toEqual(attemptBefore);
});

it("replays a retried attempt and verification without writing twice", async () => {
  const bugId = await triagedBug("Retry investigation");
  const version = await versionOf(bugId);
  const { POST } = await fixAttemptRoute();
  const attemptKey = "staff-attempt-retry-key";

  const firstAttempt = await send(POST, "POST", "admin", {
    body: attemptBody(version),
    key: attemptKey,
    params: { bugId },
  });
  const secondAttempt = await send(POST, "POST", "admin", {
    body: attemptBody(version),
    key: attemptKey,
    params: { bugId },
  });

  expect(firstAttempt.status).toBe(200);
  expect(secondAttempt.status).toBe(200);
  expect(secondAttempt.body.data).toEqual(firstAttempt.body.data);
  const [attempt] = await attemptsOf(bugId);
  expect(await attemptsOf(bugId)).toHaveLength(1);
  if (!attempt) {
    throw new Error("attempt missing");
  }

  const { POST: verify } = await verificationRoute();
  const verifyVersion = await versionOf(bugId);
  const verifyKey = "staff-verify-retry-key";
  const firstVerify = await send(verify, "POST", "admin", {
    body: verificationBody(attempt.id, verifyVersion, "passed"),
    key: verifyKey,
    params: { bugId },
  });
  const afterFirst = await attemptsOf(bugId);
  const secondVerify = await send(verify, "POST", "admin", {
    body: verificationBody(attempt.id, verifyVersion, "passed"),
    key: verifyKey,
    params: { bugId },
  });

  expect(firstVerify.status).toBe(200);
  expect(secondVerify.status).toBe(200);
  expect(secondVerify.body.data).toEqual(firstVerify.body.data);
  expect(await attemptsOf(bugId)).toEqual(afterFirst);
});

it("answers each write in the shape the route list declares", async () => {
  const bugId = await triagedBug("Investigation shape check");
  const { POST } = await fixAttemptRoute();
  const { staffBugActionRoutes } =
    await import("../../src/mobile-api/routes-bugs");

  const attemptReply = await send(POST, "POST", "admin", {
    body: attemptBody(await versionOf(bugId)),
    params: { bugId },
  });

  expect(() =>
    Schema.decodeUnknownSync(staffBugActionRoutes.fixAttempt.data)(
      attemptReply.body.data
    )
  ).not.toThrow();

  const [attempt] = await attemptsOf(bugId);
  if (!attempt) {
    throw new Error("attempt missing");
  }
  const { POST: verify } = await verificationRoute();
  const verifyReply = await send(verify, "POST", "admin", {
    body: verificationBody(attempt.id, await versionOf(bugId), "passed"),
    params: { bugId },
  });

  expect(() =>
    Schema.decodeUnknownSync(staffBugActionRoutes.verification.data)(
      verifyReply.body.data
    )
  ).not.toThrow();
});
