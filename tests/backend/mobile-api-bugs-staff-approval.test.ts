import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Schema } from "effect";

import {
  authPool,
  ids,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import {
  bugRow,
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

const submitRoute = () => import("../../apps/web/app/api/v1/portal/bugs/route");
const triageRoute = () =>
  import("../../apps/web/app/api/v1/workspace/bugs/[bugId]/triage/route");
const fixAttemptRoute = () =>
  import("../../apps/web/app/api/v1/workspace/bugs/[bugId]/fix-attempts/route");
const verificationRoute = () =>
  import("../../apps/web/app/api/v1/workspace/bugs/[bugId]/verifications/route");
const approvalRoute = () =>
  import("../../apps/web/app/api/v1/workspace/bugs/[bugId]/approval/route");
const decisionRoute = () =>
  import("../../apps/web/app/api/v1/workspace/bugs/[bugId]/approval/decision/route");

interface ApprovalRow {
  readonly comment: string | null;
  readonly decidedById: string | null;
  readonly fixAttemptId: string;
  readonly id: string;
  readonly rejectionReason: string | null;
  readonly snapshot: {
    readonly afterEvidenceIds: string[];
    readonly beforeEvidenceIds: string[];
    readonly verificationNotes: string | null;
  };
  readonly status: string;
  readonly submittedById: string;
}

const approvalsOf = async (bugId: string): Promise<ApprovalRow[]> => {
  const result = await authPool.query<ApprovalRow>(
    `SELECT comment, "decidedById", "fixAttemptId", id, "rejectionReason",
            snapshot, status, "submittedById"
     FROM bug_approval
     WHERE "bugReportId" = $1
     ORDER BY "submittedAt"`,
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

const addAttempt = async (bugId: string): Promise<string> => {
  const { POST } = await fixAttemptRoute();
  const reply = await send(POST, "POST", "owner", {
    body: {
      affectedVersion: "1.2.0",
      commitUrl: null,
      expectedVersion: await versionOf(bugId),
      fixSummary: "Guard the empty state.",
      fixedVersion: "1.3.0",
      pullRequestUrl: "https://example.com/pr/42",
      rootCause: "The list assumed at least one row.",
      verificationSteps: ["Open the empty list", "Reload"],
    },
    params: { bugId },
  });
  if (reply.status !== 200) {
    throw new Error(JSON.stringify(reply.body));
  }
  const result = await authPool.query<{ id: string }>(
    'SELECT id FROM bug_fix_attempt WHERE "bugReportId" = $1 ORDER BY "createdAt" DESC',
    [bugId]
  );
  const [attempt] = result.rows;
  if (!attempt) {
    throw new Error("attempt missing");
  }
  return attempt.id;
};

const seedEvidence = async (
  bugId: string,
  attemptId: string
): Promise<void> => {
  for (const kind of ["before", "after"]) {
    // eslint-disable-next-line no-await-in-loop
    await authPool.query(
      `INSERT INTO bug_evidence (id, "bugReportId", "fixAttemptId", "uploadedById", kind, "externalUrl", caption)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        randomUUID(),
        bugId,
        attemptId,
        personaId("owner"),
        kind,
        `https://example.com/${kind}.png`,
        `${kind} screenshot`,
      ]
    );
  }
};

// A client bug with a passed verification, ready for an approval submission.
const verifiedBug = async (
  title: string,
  evidence = true
): Promise<{ attemptId: string; bugId: string; version: number }> => {
  const bugId = await triagedBug(title);
  const attemptId = await addAttempt(bugId);
  const version = await versionOf(bugId);
  const { POST } = await verificationRoute();
  const verified = await send(POST, "POST", "owner", {
    body: {
      attemptId,
      expectedVersion: version,
      notes: "Looked right on staging.",
      outcome: "passed",
      testedEnvironment: "staging",
      testedVersion: "1.3.0",
    },
    params: { bugId },
  });
  if (verified.status !== 200) {
    throw new Error(JSON.stringify(verified.body));
  }
  if (evidence) {
    await seedEvidence(bugId, attemptId);
  }
  return { attemptId, bugId, version: await versionOf(bugId) };
};

const pendingApproval = async (
  title: string
): Promise<{
  approvalId: string;
  attemptId: string;
  bugId: string;
  version: number;
}> => {
  const prepared = await verifiedBug(title);
  const { POST } = await approvalRoute();
  const submitted = await send(POST, "POST", "owner", {
    body: {
      expectedVersion: prepared.version,
      fixAttemptId: prepared.attemptId,
    },
    params: { bugId: prepared.bugId },
  });
  if (submitted.status !== 200) {
    throw new Error(JSON.stringify(submitted.body));
  }
  const [approval] = await approvalsOf(prepared.bugId);
  if (!approval) {
    throw new Error("approval missing");
  }
  return {
    approvalId: approval.id,
    attemptId: prepared.attemptId,
    bugId: prepared.bugId,
    version: await versionOf(prepared.bugId),
  };
};

const decisionBody = (
  approvalId: string,
  expectedVersion: number,
  decision: "approved" | "rejected",
  rejectionReason: string | null = null
) => ({
  approvalId,
  comment: decision === "approved" ? "Looks good." : null,
  decision,
  expectedVersion,
  rejectionReason,
});

it("lets an assignee submit a verified fix for approval", async () => {
  const prepared = await verifiedBug("Submit approval");
  const { POST } = await approvalRoute();

  const reply = await send(POST, "POST", "owner", {
    body: {
      expectedVersion: prepared.version,
      fixAttemptId: prepared.attemptId,
    },
    params: { bugId: prepared.bugId },
  });

  expect(reply.status).toBe(200);
  expect(reply.body.data).toEqual({
    bugId: prepared.bugId,
    status: "awaiting_admin_approval",
    version: prepared.version + 1,
  });
  const [approval] = await approvalsOf(prepared.bugId);
  expect(approval).toMatchObject({
    fixAttemptId: prepared.attemptId,
    status: "pending",
    submittedById: personaId("owner"),
  });
  expect(approval?.snapshot.verificationNotes).toBe("Looked right on staging.");
  expect(approval?.snapshot.beforeEvidenceIds).toHaveLength(1);
  expect(approval?.snapshot.afterEvidenceIds).toHaveLength(1);
});

it("refuses a submission without verified before and after evidence", async () => {
  const unprepared = await verifiedBug("Submit without evidence", false);
  const { POST } = await approvalRoute();

  const noEvidence = await send(POST, "POST", "owner", {
    body: {
      expectedVersion: unprepared.version,
      fixAttemptId: unprepared.attemptId,
    },
    params: { bugId: unprepared.bugId },
  });

  expect(noEvidence.status).toBe(422);
  expect(await statusOf(unprepared.bugId)).toBe("in_verification");
  expect(await approvalsOf(unprepared.bugId)).toHaveLength(0);

  const earlyBug = await triagedBug("Submit before verification");
  const earlyAttempt = await addAttempt(earlyBug);
  const early = await send(POST, "POST", "owner", {
    body: {
      expectedVersion: await versionOf(earlyBug),
      fixAttemptId: earlyAttempt,
    },
    params: { bugId: earlyBug },
  });

  expect(early.status).toBe(409);
  expect(await statusOf(earlyBug)).toBe("in_progress");
  expect(await approvalsOf(earlyBug)).toHaveLength(0);
});

it("refuses a submission from an outsider or on a stale version, leaving the bug unchanged", async () => {
  const prepared = await verifiedBug("Submit permissions");
  const before = await bugRow(prepared.bugId);
  const { POST } = await approvalRoute();

  const outsider = await send(POST, "POST", "outsider", {
    body: {
      expectedVersion: prepared.version,
      fixAttemptId: prepared.attemptId,
    },
    params: { bugId: prepared.bugId },
  });
  const stale = await send(POST, "POST", "owner", {
    body: {
      expectedVersion: prepared.version + 5,
      fixAttemptId: prepared.attemptId,
    },
    params: { bugId: prepared.bugId },
  });

  expect(outsider.status).toBe(403);
  expect(stale.status).toBe(409);
  expect(await bugRow(prepared.bugId)).toEqual(before);
  expect(await approvalsOf(prepared.bugId)).toHaveLength(0);
});

it("lets an admin approve a pending fix", async () => {
  const pending = await pendingApproval("Approve me");
  const { POST } = await decisionRoute();

  const reply = await send(POST, "POST", "admin", {
    body: decisionBody(pending.approvalId, pending.version, "approved"),
    params: { bugId: pending.bugId },
  });

  expect(reply.status).toBe(200);
  expect(reply.body.data).toEqual({
    bugId: pending.bugId,
    status: "approved_for_release",
    version: pending.version + 1,
  });
  const [approval] = await approvalsOf(pending.bugId);
  expect(approval).toMatchObject({
    comment: "Looks good.",
    decidedById: personaId("admin"),
    rejectionReason: null,
    status: "approved",
  });
  expect(await statusOf(pending.bugId)).toBe("approved_for_release");
});

it("lets an admin reject a pending fix with a reason and refuses one without", async () => {
  const rejected = await pendingApproval("Reject me");
  const { POST } = await decisionRoute();

  const reply = await send(POST, "POST", "admin", {
    body: decisionBody(
      rejected.approvalId,
      rejected.version,
      "rejected",
      "The regression test is missing."
    ),
    params: { bugId: rejected.bugId },
  });

  expect(reply.status).toBe(200);
  expect(reply.body.data.status).toBe("rejected");
  const [approval] = await approvalsOf(rejected.bugId);
  expect(approval).toMatchObject({
    decidedById: personaId("admin"),
    rejectionReason: "The regression test is missing.",
    status: "rejected",
  });

  const unreasoned = await pendingApproval("Reject without a reason");
  const refused = await send(POST, "POST", "admin", {
    body: decisionBody(unreasoned.approvalId, unreasoned.version, "rejected"),
    params: { bugId: unreasoned.bugId },
  });

  expect(refused.status).toBe(422);
  expect(await statusOf(unreasoned.bugId)).toBe("awaiting_admin_approval");
  const [stillPending] = await approvalsOf(unreasoned.bugId);
  expect(stillPending?.status).toBe("pending");
});

it("refuses a decision from an employee or a client, and a decided approval again", async () => {
  const pending = await pendingApproval("Decision permissions");
  const before = await bugRow(pending.bugId);
  const { POST } = await decisionRoute();

  const employee = await send(POST, "POST", "owner", {
    body: decisionBody(pending.approvalId, pending.version, "approved"),
    params: { bugId: pending.bugId },
  });
  const client = await send(POST, "POST", "client", {
    body: decisionBody(pending.approvalId, pending.version, "approved"),
    params: { bugId: pending.bugId },
  });

  expect(employee.status).toBe(403);
  expect(client.status).toBe(403);
  expect(await bugRow(pending.bugId)).toEqual(before);

  const approved = await send(POST, "POST", "admin", {
    body: decisionBody(pending.approvalId, pending.version, "approved"),
    params: { bugId: pending.bugId },
  });
  const again = await send(POST, "POST", "admin", {
    body: decisionBody(
      pending.approvalId,
      await versionOf(pending.bugId),
      "rejected",
      "Changed my mind."
    ),
    params: { bugId: pending.bugId },
  });

  expect(approved.status).toBe(200);
  expect(again.status).toBe(409);
  const [approval] = await approvalsOf(pending.bugId);
  expect(approval?.status).toBe("approved");
});

it("gives one of two simultaneous decisions the approval", async () => {
  const pending = await pendingApproval("Decision race");
  const { POST } = await decisionRoute();

  const replies = await Promise.all(
    (["approved", "rejected"] as const).map((decision) =>
      send(POST, "POST", "admin", {
        body: decisionBody(
          pending.approvalId,
          pending.version,
          decision,
          decision === "rejected" ? "Not ready." : null
        ),
        params: { bugId: pending.bugId },
      })
    )
  );

  expect(replies.map((reply) => reply.status).toSorted()).toEqual([200, 409]);
  const [approval] = await approvalsOf(pending.bugId);
  expect(["approved", "rejected"]).toContain(approval?.status ?? "");
  expect(await statusOf(pending.bugId)).toBe(
    approval?.status === "approved" ? "approved_for_release" : "rejected"
  );
});

it("replays a retried submission and decision without writing twice", async () => {
  const prepared = await verifiedBug("Retry approval");
  const { POST } = await approvalRoute();
  const submitBody = {
    expectedVersion: prepared.version,
    fixAttemptId: prepared.attemptId,
  };
  const submitKey = "staff-approval-submit-key";

  const firstSubmit = await send(POST, "POST", "owner", {
    body: submitBody,
    key: submitKey,
    params: { bugId: prepared.bugId },
  });
  const secondSubmit = await send(POST, "POST", "owner", {
    body: submitBody,
    key: submitKey,
    params: { bugId: prepared.bugId },
  });

  expect(firstSubmit.status).toBe(200);
  expect(secondSubmit.status).toBe(200);
  expect(secondSubmit.body.data).toEqual(firstSubmit.body.data);
  const [approval] = await approvalsOf(prepared.bugId);
  expect(await approvalsOf(prepared.bugId)).toHaveLength(1);
  if (!approval) {
    throw new Error("approval missing");
  }

  const { POST: decide } = await decisionRoute();
  const decisionVersion = await versionOf(prepared.bugId);
  const decisionKey = "staff-approval-decision-key";
  const decision = decisionBody(approval.id, decisionVersion, "approved");
  const firstDecision = await send(decide, "POST", "admin", {
    body: decision,
    key: decisionKey,
    params: { bugId: prepared.bugId },
  });
  const afterFirst = await approvalsOf(prepared.bugId);
  const secondDecision = await send(decide, "POST", "admin", {
    body: decision,
    key: decisionKey,
    params: { bugId: prepared.bugId },
  });

  expect(firstDecision.status).toBe(200);
  expect(secondDecision.status).toBe(200);
  expect(secondDecision.body.data).toEqual(firstDecision.body.data);
  expect(await approvalsOf(prepared.bugId)).toEqual(afterFirst);
});

it("refuses an approval that belongs to another bug and leaves both unchanged", async () => {
  const first = await pendingApproval("Approval scope one");
  const second = await pendingApproval("Approval scope two");
  const { POST } = await decisionRoute();

  const reply = await send(POST, "POST", "admin", {
    body: decisionBody(second.approvalId, second.version, "approved"),
    params: { bugId: first.bugId },
  });

  expect(reply.status).toBe(422);
  const [firstApproval] = await approvalsOf(first.bugId);
  const [secondApproval] = await approvalsOf(second.bugId);
  expect(firstApproval?.status).toBe("pending");
  expect(secondApproval?.status).toBe("pending");
  expect(await statusOf(first.bugId)).toBe("awaiting_admin_approval");
  expect(await statusOf(second.bugId)).toBe("awaiting_admin_approval");
});

it("answers each write in the shape the route list declares", async () => {
  const prepared = await verifiedBug("Approval shape check");
  const { POST } = await approvalRoute();
  const { staffBugActionRoutes } =
    await import("../../src/mobile-api/routes-bugs");

  const submitted = await send(POST, "POST", "owner", {
    body: {
      expectedVersion: prepared.version,
      fixAttemptId: prepared.attemptId,
    },
    params: { bugId: prepared.bugId },
  });

  expect(() =>
    Schema.decodeUnknownSync(staffBugActionRoutes.approval.data)(
      submitted.body.data
    )
  ).not.toThrow();

  const [approval] = await approvalsOf(prepared.bugId);
  if (!approval) {
    throw new Error("approval missing");
  }
  const { POST: decide } = await decisionRoute();
  const decided = await send(decide, "POST", "admin", {
    body: decisionBody(
      approval.id,
      await versionOf(prepared.bugId),
      "approved"
    ),
    params: { bugId: prepared.bugId },
  });

  expect(() =>
    Schema.decodeUnknownSync(staffBugActionRoutes.approvalDecision.data)(
      decided.body.data
    )
  ).not.toThrow();
});
