import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import { Storage } from "../../src/server/storage/storage";
import { UploadsLive } from "../../src/server/storage/uploads";
import { Uploads } from "../../src/server/storage/uploads-contracts";
import {
  authPool,
  callAs,
  ids,
  nextKey,
  personaId,
  replay,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";

const portal = await import("../../features/portal/portal-actions");
const portalQueries = await import("../../features/portal/portal-queries");
const comments = await import("../../features/tasks/actions/task-comments");

beforeAll(async () => {
  await setupHarness();
  // The client company reports on the harness project.
  await authPool.query(
    'INSERT INTO client_company_project (id, "companyId", "projectId") VALUES ($1, $2, $3)',
    [randomUUID(), ids.clientCompanyId, ids.projectId]
  );
});
afterAll(teardownHarness);

const bugInput = (overrides: Record<string, unknown> = {}) => ({
  actualBehavior: "The page crashes",
  browser: "Firefox 140",
  description: "Happens every time",
  device: "Desktop",
  expectedBehavior: "The page loads",
  impact: "high",
  os: "Linux",
  pageUrl: "https://app.example.test/settings",
  projectId: ids.projectId,
  reproductionSteps: ["Open settings", "Click save"],
  title: "Settings page crashes",
  ...overrides,
});

const submit = async (overrides: Record<string, unknown> = {}) => {
  const result = await callAs("client", portal.submitClientBugAction, {
    ...bugInput(overrides),
    idempotencyKey: nextKey(),
  });
  if (!result.ok) {
    throw new Error(`submit failed: ${result.error.message}`);
  }
  return result.data as { bugId: string; version: number };
};

const taskOf = async (bugId: string): Promise<string> => {
  const row = await authPool.query<{ taskId: string }>(
    'SELECT "taskId" FROM bug_report WHERE id = $1',
    [bugId]
  );
  return row.rows[0]?.taskId ?? "";
};

it("files a client bug against an active company project", async () => {
  const idempotencyKey = nextKey();
  const first = await callAs("client", portal.submitClientBugAction, {
    ...bugInput(),
    idempotencyKey,
  });
  const second = await callAs("client", portal.submitClientBugAction, {
    ...bugInput(),
    idempotencyKey,
  });
  if (!first.ok || !second.ok) {
    throw new Error("submit failed");
  }
  // A retry with the same key replays the first result instead of filing twice.
  expect(second.data).toEqual(first.data);
  const row = await authPool.query<{
    clientCompanyId: string;
    clientImpact: string;
    discoverySource: string;
    environment: string;
    reporterId: string;
    status: string;
    severity: string;
    type: string;
  }>(
    'SELECT b."clientCompanyId", b."clientImpact", b."discoverySource", b.environment, b."reporterId", b.status, b.severity, t.type FROM bug_report b JOIN task t ON t.id = b."taskId" WHERE b.id = $1',
    [first.data.bugId]
  );
  expect(row.rows[0]).toMatchObject({
    clientCompanyId: ids.clientCompanyId,
    clientImpact: "high",
    discoverySource: "customer_report",
    environment: "production",
    reporterId: personaId("client"),
    severity: "critical",
    status: "reported",
    type: "bug",
  });
});

it("refuses a project the company does not have", async () => {
  const result = await callAs("client", portal.submitClientBugAction, {
    ...bugInput({ projectId: ids.archivedProjectId }),
    idempotencyKey: nextKey(),
  });
  expect(result).toMatchObject({
    error: { code: "VALIDATION_FAILED" },
    ok: false,
  });
  const projects = await callAs("client", portalQueries.listPortalProjects, {});
  expect(projects.ok && projects.data.map(({ id }) => id)).toEqual([
    ids.projectId,
  ]);
});

it("shows every company bug to colleagues and none to another company", async () => {
  const bug = await submit({ title: "Visible to the whole company" });
  const colleague = await callAs("coworker", portalQueries.listPortalBugs, {});
  expect(
    colleague.ok && colleague.data.some(({ id }) => id === bug.bugId)
  ).toBe(true);
  const mine = await callAs("coworker", portalQueries.listPortalBugs, {
    mine: true,
  });
  expect(mine.ok && mine.data.some(({ id }) => id === bug.bugId)).toBe(false);
  const detail = await callAs("coworker", portalQueries.getPortalBug, {
    bugId: bug.bugId,
  });
  expect(detail).toMatchObject({
    data: { canEdit: false, isMine: false, status: "submitted" },
    ok: true,
  });

  const other = await callAs("otherClient", portalQueries.listPortalBugs, {});
  expect(other).toMatchObject({ data: [], ok: true });
  const hidden = await callAs("otherClient", portalQueries.getPortalBug, {
    bugId: bug.bugId,
  });
  expect(hidden).toMatchObject({ error: { code: "NOT_FOUND" }, ok: false });
  const comment = await callAs("otherClient", portal.addClientCommentAction, {
    body: "I should not be able to write here",
    bugId: bug.bugId,
    idempotencyKey: nextKey(),
  });
  expect(comment).toMatchObject({ error: { code: "NOT_FOUND" }, ok: false });
});

it("keeps internal notes, fix attempts and approvals out of the portal", async () => {
  const bug = await submit({ title: "Leak check" });
  const taskId = await taskOf(bug.bugId);
  await authPool.query(
    'INSERT INTO task_assignee ("taskId", "userId", "assignedById") VALUES ($1, $2, $2)',
    [taskId, personaId("owner")]
  );
  const secret = `internal-secret-${randomUUID()}`;
  const internal = await callAs("owner", comments.createCommentAction, {
    body: secret,
    idempotencyKey: nextKey(),
    taskId,
  });
  expect(internal).toMatchObject({
    data: { visibility: "internal" },
    ok: true,
  });
  const publicReply = await callAs("owner", comments.createCommentAction, {
    body: "We are looking into it",
    idempotencyKey: nextKey(),
    taskId,
    visibility: "public",
  });
  expect(publicReply).toMatchObject({
    data: { visibility: "public" },
    ok: true,
  });
  await authPool.query(
    'INSERT INTO bug_fix_attempt (id, "bugReportId", "authorId", "rootCause", "fixSummary", "verificationSteps") VALUES ($1, $2, $3, $4, $5, ARRAY[\'Retest\'])',
    [
      randomUUID(),
      bug.bugId,
      personaId("owner"),
      "Secret root cause",
      "Secret fix summary",
    ]
  );
  // Staff-uploaded evidence is not the client's to see.
  const staffFile = randomUUID();
  await authPool.query(
    'INSERT INTO file_asset (id, "projectId", "taskId", "uploadedById", "originalName", "storageKey", "contentType", "sizeBytes") VALUES ($1, $2, $3, $4, \'internal-trace.png\', $5, \'image/png\', 10)',
    [
      staffFile,
      ids.projectId,
      taskId,
      personaId("owner"),
      `tasks/${staffFile}/x`,
    ]
  );
  await authPool.query(
    'INSERT INTO bug_evidence (id, "bugReportId", "uploadedById", "fileAssetId", kind, caption) VALUES ($1, $2, $3, $4, \'before\', \'Staff evidence\')',
    [randomUUID(), bug.bugId, personaId("owner"), staffFile]
  );

  const detail = await callAs("client", portalQueries.getPortalBug, {
    bugId: bug.bugId,
  });
  if (!detail.ok) {
    throw new Error(detail.error.message);
  }
  const serialized = JSON.stringify(detail.data);
  expect(serialized).not.toContain(secret);
  expect(serialized).not.toContain("Secret root cause");
  expect(serialized).not.toContain("Secret fix summary");
  expect(serialized).not.toContain("internal-trace.png");
  expect(detail.data.comments.map(({ body }) => body)).toEqual([
    "We are looking into it",
  ]);
  expect(detail.data.comments[0]).toMatchObject({ isTeam: true });
  expect(detail.data.attachments).toEqual([]);
  const file = await callAs("client", portal.getPortalFileUrlAction, {
    disposition: "download",
    fileId: staffFile,
  });
  expect(file).toMatchObject({ error: { code: "NOT_FOUND" }, ok: false });

  // The reporter created the task but only hears about the public reply.
  const notices = await authPool.query<{ text: string; snippet: string }>(
    'SELECT text, snippet FROM notification WHERE "userId" = $1 AND "taskId" = $2',
    [personaId("client"), taskId]
  );
  expect(notices.rows.map(({ snippet }) => snippet)).toEqual([
    "We are looking into it",
  ]);
  const portalNotices = await callAs(
    "client",
    portalQueries.listPortalNotifications,
    {}
  );
  expect(portalNotices.ok && portalNotices.data.items[0]).toMatchObject({
    bugId: bug.bugId,
    readAt: null,
  });
});

it("lets any company user comment publicly and tells the assignee", async () => {
  const bug = await submit({ title: "Comment thread" });
  const taskId = await taskOf(bug.bugId);
  await authPool.query(
    'INSERT INTO task_assignee ("taskId", "userId", "assignedById") VALUES ($1, $2, $2)',
    [taskId, personaId("owner")]
  );
  const comment = await replay(
    "addClientCommentAction",
    "coworker",
    portal.addClientCommentAction,
    { body: "Same here on Safari", bugId: bug.bugId }
  );
  expect(comment).toMatchObject({ isMine: true, isTeam: false });
  const row = await authPool.query<{ visibility: string }>(
    "SELECT visibility FROM comment WHERE id = $1",
    [(comment as { id: string }).id]
  );
  expect(row.rows[0]?.visibility).toBe("public");
  const staffNotice = await authPool.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM notification WHERE "userId" = $1 AND "taskId" = $2',
    [personaId("owner"), taskId]
  );
  expect(staffNotice.rows[0]?.count).toBe(1);
  const seen = await callAs("client", portalQueries.getPortalBug, {
    bugId: bug.bugId,
  });
  expect(seen.ok && seen.data.comments).toHaveLength(1);
});

it("keeps bugs on a removed project readable but read only", async () => {
  const bug = await submit({ title: "Project goes away" });
  await authPool.query(
    'UPDATE client_company_project SET "removedAt" = now() WHERE "companyId" = $1 AND "projectId" = $2',
    [ids.clientCompanyId, ids.projectId]
  );
  try {
    const view = await callAs("client", portalQueries.getPortalBug, {
      bugId: bug.bugId,
    });
    expect(view).toMatchObject({
      data: {
        canAttach: false,
        canComment: false,
        canEdit: false,
        canWithdraw: false,
        readOnlyReason: expect.stringContaining("read only"),
      },
      ok: true,
    });
    const comment = await callAs("coworker", portal.addClientCommentAction, {
      body: "Still seeing it",
      bugId: bug.bugId,
      idempotencyKey: nextKey(),
    });
    expect(comment).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
    const edit = await callAs("client", portal.editClientBugAction, {
      ...bugInput({ title: "Edited" }),
      bugId: bug.bugId,
      expectedVersion: bug.version,
      idempotencyKey: nextKey(),
    });
    expect(edit).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
    const withdraw = await callAs("client", portal.withdrawClientBugAction, {
      bugId: bug.bugId,
      expectedVersion: bug.version,
      idempotencyKey: nextKey(),
    });
    expect(withdraw).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
    // New reports on that project are refused too.
    const fresh = await callAs("client", portal.submitClientBugAction, {
      ...bugInput(),
      idempotencyKey: nextKey(),
    });
    expect(fresh).toMatchObject({ ok: false });
  } finally {
    await authPool.query(
      'UPDATE client_company_project SET "removedAt" = NULL WHERE "companyId" = $1 AND "projectId" = $2',
      [ids.clientCompanyId, ids.projectId]
    );
  }
});

it("rejects public comments on ordinary tasks", async () => {
  const result = await callAs("owner", comments.createCommentAction, {
    body: "Public on an ordinary task",
    idempotencyKey: nextKey(),
    taskId: ids.taskId,
    visibility: "public",
  });
  expect(result).toMatchObject({
    error: { code: "VALIDATION_FAILED" },
    ok: false,
  });
});

it("lets only the reporter edit or withdraw, and only while Submitted", async () => {
  const bug = await submit({ title: "Edit me" });
  const edit = {
    ...bugInput({ impact: "urgent", title: "Edited title" }),
    bugId: bug.bugId,
    expectedVersion: bug.version,
  };
  delete (edit as Record<string, unknown>)["projectId"];

  const byColleague = await callAs("coworker", portal.editClientBugAction, {
    ...edit,
    idempotencyKey: nextKey(),
  });
  expect(byColleague).toMatchObject({
    error: { code: "FORBIDDEN" },
    ok: false,
  });
  const stale = await callAs("client", portal.editClientBugAction, {
    ...edit,
    expectedVersion: bug.version + 3,
    idempotencyKey: nextKey(),
  });
  expect(stale).toMatchObject({ error: { code: "CONFLICT" }, ok: false });

  const edited = await replay(
    "editClientBugAction",
    "client",
    portal.editClientBugAction,
    edit
  );
  expect(edited).toMatchObject({ bugId: bug.bugId, version: bug.version + 1 });
  const detail = await callAs("client", portalQueries.getPortalBug, {
    bugId: bug.bugId,
  });
  expect(detail).toMatchObject({
    data: { canEdit: true, impact: "urgent", title: "Edited title" },
    ok: true,
  });

  const withdrawByColleague = await callAs(
    "coworker",
    portal.withdrawClientBugAction,
    {
      bugId: bug.bugId,
      expectedVersion: bug.version + 1,
      idempotencyKey: nextKey(),
    }
  );
  expect(withdrawByColleague).toMatchObject({
    error: { code: "FORBIDDEN" },
    ok: false,
  });
  const withdrawn = await replay(
    "withdrawClientBugAction",
    "client",
    portal.withdrawClientBugAction,
    { bugId: bug.bugId, expectedVersion: bug.version + 1 }
  );
  expect(withdrawn.version).toBe(bug.version + 2);
  const state = await authPool.query<{ status: string; taskStatus: string }>(
    'SELECT b.status, t.status AS "taskStatus" FROM bug_report b JOIN task t ON t.id = b."taskId" WHERE b.id = $1',
    [bug.bugId]
  );
  expect(state.rows[0]).toEqual({ status: "withdrawn", taskStatus: "done" });
  const after = await callAs("client", portal.addClientCommentAction, {
    body: "Too late",
    bugId: bug.bugId,
    idempotencyKey: nextKey(),
  });
  expect(after).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
  const list = await callAs("client", portalQueries.listPortalBugs, {
    status: "withdrawn",
  });
  expect(list.ok && list.data.map(({ id }) => id)).toContain(bug.bugId);

  const triaged = await submit({ title: "Already triaged" });
  await authPool.query(
    "UPDATE bug_report SET status = 'triaged' WHERE id = $1",
    [triaged.bugId]
  );
  const late = await callAs("client", portal.withdrawClientBugAction, {
    bugId: triaged.bugId,
    expectedVersion: triaged.version,
    idempotencyKey: nextKey(),
  });
  expect(late).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
  const lateDetail = await callAs("client", portalQueries.getPortalBug, {
    bugId: triaged.bugId,
  });
  expect(lateDetail).toMatchObject({
    data: { canEdit: false, canWithdraw: false, status: "acknowledged" },
    ok: true,
  });
});

const storageLayer = Layer.succeed(
  Storage,
  Storage.of({
    copyObject: () => Effect.void,
    deleteObject: () => Effect.void,
    signDownload: () => Effect.succeed("https://private.example/download"),
    signPreview: () => Effect.succeed("https://private.example/preview"),
    signUpload: () => Effect.succeed("https://private.example/upload"),
    verifyObject: () => Effect.void,
  })
);

const withUploads = <Value, Failure>(
  program: Effect.Effect<Value, Failure, Uploads>
) =>
  Effect.runPromise(
    Effect.provide(program, Layer.provide(UploadsLive, storageLayer))
  );

it("limits client uploads by type, size and count, and scopes them to the company", async () => {
  const bug = await submit({ title: "Uploads" });
  const taskId = await taskOf(bug.bugId);
  const request = (
    actor: string,
    contentType: string,
    sizeBytes: number,
    task = taskId
  ) =>
    withUploads(
      Effect.exit(
        Effect.gen(function* requestUpload() {
          const uploads = yield* Uploads;
          return yield* uploads.requestTaskUpload(actor, {
            contentType,
            fileName: "screenshot",
            sizeBytes,
            taskId: task,
          });
        })
      )
    );
  const rejected = (exit: Awaited<ReturnType<typeof request>>) =>
    exit._tag === "Failure";

  expect(rejected(await request(personaId("client"), "image/png", 1024))).toBe(
    false
  );
  expect(rejected(await request(personaId("client"), "text/html", 1024))).toBe(
    true
  );
  expect(
    rejected(await request(personaId("client"), "application/zip", 1024))
  ).toBe(true);
  expect(
    rejected(
      await request(personaId("client"), "image/png", 10 * 1024 * 1024 + 1)
    )
  ).toBe(true);
  expect(
    rejected(await request(personaId("client"), "video/mp4", 10 * 1024 * 1024))
  ).toBe(false);
  // Another company's client cannot upload to this bug at all.
  expect(
    rejected(await request(personaId("otherClient"), "image/png", 1024))
  ).toBe(true);
  // Nor can a client reach an ordinary task.
  expect(
    rejected(await request(personaId("client"), "image/png", 1024, ids.taskId))
  ).toBe(true);

  // Two intents are pending already; eight more fill the ten-file allowance.
  for (let index = 0; index < 8; index += 1) {
    // Sequential on purpose: each request counts the ones before it.
    // eslint-disable-next-line no-await-in-loop
    const exit = await request(personaId("client"), "image/png", 1024);
    expect(rejected(exit)).toBe(false);
  }
  expect(rejected(await request(personaId("client"), "image/png", 1024))).toBe(
    true
  );
});

it("attaches finalized screenshots and serves them only to the company", async () => {
  const bug = await submit({ title: "Screenshot" });
  const taskId = await taskOf(bug.bugId);
  const file = await withUploads(
    Effect.gen(function* uploadScreenshot() {
      const uploads = yield* Uploads;
      const ticket = yield* uploads.requestTaskUpload(personaId("client"), {
        contentType: "image/png",
        fileName: "crash.png",
        sizeBytes: 2048,
        taskId,
      });
      return yield* uploads.finalizeUpload(
        personaId("client"),
        ticket.uploadIntentId
      );
    })
  );
  const attached = await callAs("client", portal.attachClientFileAction, {
    bugId: bug.bugId,
    fileId: file.id,
  });
  expect(attached).toMatchObject({ ok: true });
  const detail = await callAs("coworker", portalQueries.getPortalBug, {
    bugId: bug.bugId,
  });
  expect(detail.ok && detail.data.attachments).toEqual([
    expect.objectContaining({
      fileId: file.id,
      fileName: "crash.png",
      previewable: true,
    }),
  ]);

  const url = (persona: "coworker" | "otherClient", disposition: string) =>
    withUploads(
      Effect.gen(function* signFile() {
        const uploads = yield* Uploads;
        return yield* Effect.exit(
          disposition === "preview"
            ? uploads.signedPreview(personaId(persona), file.id)
            : uploads.signedDownload(personaId(persona), file.id)
        );
      })
    );
  const [colleagueDownload, colleaguePreview, otherDownload, otherPreview] =
    await Promise.all([
      url("coworker", "download"),
      url("coworker", "preview"),
      url("otherClient", "download"),
      url("otherClient", "preview"),
    ]);
  expect(colleagueDownload._tag).toBe("Success");
  expect(colleaguePreview._tag).toBe("Success");
  expect(otherDownload._tag).toBe("Failure");
  expect(otherPreview._tag).toBe("Failure");

  // Linking someone else's upload, or a file from another bug, is refused.
  const foreign = await callAs("coworker", portal.attachClientFileAction, {
    bugId: bug.bugId,
    fileId: file.id,
  });
  expect(foreign).toMatchObject({ error: { code: "NOT_FOUND" }, ok: false });
});

it("marks portal notifications read for the signed-in client only", async () => {
  const bug = await submit({ title: "Notify" });
  const taskId = await taskOf(bug.bugId);
  await authPool.query(
    'INSERT INTO task_assignee ("taskId", "userId", "assignedById") VALUES ($1, $2, $2)',
    [taskId, personaId("owner")]
  );
  await callAs("owner", comments.createCommentAction, {
    body: "Public reply",
    idempotencyKey: nextKey(),
    taskId,
    visibility: "public",
  });
  const listed = await callAs(
    "client",
    portalQueries.listPortalNotifications,
    {}
  );
  if (!listed.ok) {
    throw new Error(listed.error.message);
  }
  const target = listed.data.items.find((item) => item.bugId === bug.bugId);
  expect(target).toBeDefined();
  const otherReads = await callAs(
    "otherClient",
    portal.markPortalNotificationReadAction,
    { notificationId: target?.id }
  );
  void otherReads;
  const stillUnread = await authPool.query<{ readAt: Date | null }>(
    'SELECT "readAt" FROM notification WHERE id = $1',
    [target?.id]
  );
  expect(stillUnread.rows[0]?.readAt).toBeNull();
  const read = await callAs("client", portal.markPortalNotificationReadAction, {
    notificationId: target?.id,
  });
  expect(read).toMatchObject({ ok: true });
  const all = await callAs(
    "client",
    portal.markAllPortalNotificationsReadAction,
    {}
  );
  expect(all).toMatchObject({ ok: true });
  const after = await callAs(
    "client",
    portalQueries.listPortalNotifications,
    {}
  );
  expect(after).toMatchObject({ data: { unreadCount: 0 }, ok: true });
});
