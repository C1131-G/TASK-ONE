import { afterAll, beforeAll, expect, it } from "bun:test";

import {
  authPool,
  createPersona,
  ids,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import {
  PNG_BYTES,
  expectNoSignedUrlLogged,
  expireIntent,
  fileCount,
  insertEvidence,
  insertFile,
  intentCount,
  intentState,
  objectKeys,
  putToTicket,
  removeTaskObjects,
  submitBug,
  taskPrefix,
  watchLogs,
} from "./support/mobile-attachments-fixtures";
import type { UploadTicketReply } from "./support/mobile-attachments-fixtures";
import {
  countRows,
  forceStatus,
  linkProjectToCompanies,
  send,
  setHandlers,
} from "./support/mobile-bugs-fixtures";

const touchedTasks: string[] = [];
const CLIENT_FILE_CAP = 10;
const CLIENT_MAX_BYTES = 10 * 1024 * 1024;

beforeAll(async () => {
  await setupHarness();
  await linkProjectToCompanies();
  await setHandlers(ids.clientCompanyId, ["owner"]);
});
afterAll(async () => {
  await removeTaskObjects(touchedTasks);
  await teardownHarness();
});

const uploadsRoute = () =>
  import("../../apps/web/app/api/v1/portal/attachments/uploads/route");
const finalizeRoute = () =>
  import("../../apps/web/app/api/v1/portal/attachments/uploads/[uploadIntentId]/finalize/route");
const listRoute = () =>
  import("../../apps/web/app/api/v1/portal/attachments/route");
const downloadRoute = () =>
  import("../../apps/web/app/api/v1/portal/attachments/[fileId]/download/route");
const previewRoute = () =>
  import("../../apps/web/app/api/v1/portal/attachments/[fileId]/preview/route");

const evidenceCount = (bugId: string) =>
  countRows("bug_evidence", '"bugReportId" = $1', [bugId]);

const newBug = async (title: string) => {
  const bug = await submitBug("client", title);
  touchedTasks.push(bug.taskId);
  return bug;
};

const uploadBody = (
  bugId: string,
  overrides: Record<string, unknown> = {}
) => ({
  bugId,
  contentType: "image/png",
  fileName: "shot.png",
  sizeBytes: PNG_BYTES.byteLength,
  ...overrides,
});

const trace = async (taskId: string, bugId: string) => ({
  evidence: await evidenceCount(bugId),
  files: await fileCount(taskId),
  intents: await intentCount(taskId),
  objects: await objectKeys(taskPrefix(taskId)),
});

const requestTicket = async (bugId: string): Promise<UploadTicketReply> => {
  const { POST } = await uploadsRoute();
  const reply = await send(POST, "POST", "client", {
    body: uploadBody(bugId),
    key: false,
  });
  expect(reply.status).toBe(200);
  return reply.body.data as UploadTicketReply;
};

it("refuses a type or size a client may not upload", async () => {
  const { bugId, taskId } = await newBug("Limits");
  const { POST } = await uploadsRoute();
  const before = await trace(taskId, bugId);

  const html = await send(POST, "POST", "client", {
    body: uploadBody(bugId, { contentType: "text/html", fileName: "a.html" }),
    key: false,
  });
  const big = await send(POST, "POST", "client", {
    body: uploadBody(bugId, { sizeBytes: CLIENT_MAX_BYTES + 1 }),
    key: false,
  });

  expect(html.status).toBe(422);
  expect(big.status).toBe(422);
  expect(await trace(taskId, bugId)).toEqual(before);
});

it("refuses an upload past the ten files a bug can hold", async () => {
  const { bugId, taskId } = await newBug("Cap");
  for (let count = 0; count < CLIENT_FILE_CAP; count += 1) {
    // eslint-disable-next-line no-await-in-loop
    await insertFile(taskId, "client", `f${count}.png`);
  }
  const { POST } = await uploadsRoute();
  const before = await trace(taskId, bugId);

  const reply = await send(POST, "POST", "client", {
    body: uploadBody(bugId),
    key: false,
  });

  expect(reply.status).toBe(422);
  expect(await trace(taskId, bugId)).toEqual(before);
});

it("refuses an upload to a closed bug", async () => {
  const { bugId, taskId } = await newBug("Closed");
  await forceStatus(bugId, "closed");
  const { POST } = await uploadsRoute();
  const before = await trace(taskId, bugId);

  const reply = await send(POST, "POST", "client", {
    body: uploadBody(bugId),
    key: false,
  });

  expect(reply.status).toBe(403);
  expect(await trace(taskId, bugId)).toEqual(before);
});

it("hides another company's bug from upload, list and finalize", async () => {
  const { bugId, taskId } = await newBug("Isolated");
  const { POST: request } = await uploadsRoute();
  const { POST: finalize } = await finalizeRoute();
  const { GET: list } = await listRoute();
  const ticket = await requestTicket(bugId);
  await putToTicket(ticket, PNG_BYTES);
  const before = await trace(taskId, bugId);

  const upload = await send(request, "POST", "otherClient", {
    body: uploadBody(bugId),
    key: false,
  });
  const listed = await send(list, "GET", "otherClient", { query: { bugId } });
  const stolen = await send(finalize, "POST", "otherClient", {
    body: { bugId },
    params: { uploadIntentId: ticket.uploadIntentId },
  });

  expect(upload.status).toBe(404);
  expect(listed.status).toBe(404);
  expect(stolen.status).toBe(403);
  expect(await trace(taskId, bugId)).toEqual(before);
  expect(await intentState(ticket.uploadIntentId)).toBe("pending");
});

it("refuses to finalize a colleague's intent or an expired one", async () => {
  const { bugId, taskId } = await newBug("Finalize refusals");
  const { POST: finalize } = await finalizeRoute();
  const theirs = await requestTicket(bugId);
  await putToTicket(theirs, PNG_BYTES);
  const late = await requestTicket(bugId);
  await putToTicket(late, PNG_BYTES);
  await expireIntent(late.uploadIntentId);
  const before = await trace(taskId, bugId);

  const colleague = await send(finalize, "POST", "coworker", {
    body: { bugId },
    params: { uploadIntentId: theirs.uploadIntentId },
  });
  const expired = await send(finalize, "POST", "client", {
    body: { bugId },
    params: { uploadIntentId: late.uploadIntentId },
  });

  expect(colleague.status).toBe(403);
  expect(expired.status).toBe(409);
  expect(await trace(taskId, bugId)).toEqual(before);
});

it("refuses a finalize that names a different bug and keeps nothing", async () => {
  const first = await newBug("First bug");
  const second = await newBug("Second bug");
  const { POST: finalize } = await finalizeRoute();
  const ticket = await requestTicket(first.bugId);
  await putToTicket(ticket, PNG_BYTES);
  const before = await trace(first.taskId, first.bugId);

  const reply = await send(finalize, "POST", "client", {
    body: { bugId: second.bugId },
    params: { uploadIntentId: ticket.uploadIntentId },
  });

  expect(reply.status).toBe(404);
  expect(await trace(first.taskId, first.bugId)).toEqual(before);
  expect(await intentState(ticket.uploadIntentId)).toBe("pending");
});

it("returns the same attachment for a second finalize", async () => {
  const { bugId, taskId } = await newBug("Twice");
  const { POST: finalize } = await finalizeRoute();
  const ticket = await requestTicket(bugId);
  await putToTicket(ticket, PNG_BYTES);
  const params = { uploadIntentId: ticket.uploadIntentId };

  const first = await send(finalize, "POST", "client", {
    body: { bugId },
    params,
  });
  const second = await send(finalize, "POST", "client", {
    body: { bugId },
    params,
  });

  expect(first.status).toBe(200);
  expect(second.body.data).toEqual(first.body.data);
  expect(await fileCount(taskId)).toBe(1);
  expect(await evidenceCount(bugId)).toBe(1);
});

it("lists and opens colleagues' files but never staff files", async () => {
  const { bugId, taskId } = await newBug("Visibility");
  const colleagueFile = await insertFile(taskId, "coworker", "theirs.png");
  const staffFile = await insertFile(taskId, "owner", "internal.png");
  await insertEvidence(bugId, colleagueFile, "coworker");
  await insertEvidence(bugId, staffFile, "owner");
  const { GET: list } = await listRoute();
  const { GET: download } = await downloadRoute();
  const { GET: preview } = await previewRoute();

  const listed = await send(list, "GET", "client", { query: { bugId } });
  const colleagueLink = await send(download, "GET", "client", {
    params: { fileId: colleagueFile },
  });
  const staffDownload = await send(download, "GET", "client", {
    params: { fileId: staffFile },
  });
  const staffPreview = await send(preview, "GET", "client", {
    params: { fileId: staffFile },
  });
  const foreign = await send(download, "GET", "otherClient", {
    params: { fileId: colleagueFile },
  });

  const listedIds = (listed.body.data.items as { fileId: string }[]).map(
    ({ fileId }) => fileId
  );
  expect(listedIds).toEqual([colleagueFile]);
  expect(colleagueLink.status).toBe(200);
  expect(staffDownload.status).toBe(404);
  expect(staffPreview.status).toBe(404);
  expect(foreign.status).toBe(404);
});

it("refuses a link for a file that is removed after it was visible", async () => {
  const { bugId, taskId } = await newBug("Removed");
  const fileId = await insertFile(taskId, "client");
  await insertEvidence(bugId, fileId, "client");
  const { GET: download } = await downloadRoute();
  const { GET: preview } = await previewRoute();
  const logs = watchLogs();

  const visible = await send(preview, "GET", "client", { params: { fileId } });
  await authPool.query(
    'UPDATE file_asset SET "deletedAt" = now() WHERE id = $1',
    [fileId]
  );
  const removed = await send(download, "GET", "client", { params: { fileId } });

  expect(visible.status).toBe(200);
  expect(removed.status).toBe(404);
  expectNoSignedUrlLogged(logs, visible.body.data.url as string);
  logs.stop();
});

it("answers 401, 403 and 422 across the portal attachment routes", async () => {
  const { bugId } = await newBug("Matrix");
  const { POST: request } = await uploadsRoute();
  const { POST: finalize } = await finalizeRoute();
  const { GET: list } = await listRoute();
  const { GET: download } = await downloadRoute();
  const unknown = crypto.randomUUID();
  const revoked = await createPersona("employee", "revokedclient");
  await authPool.query(
    `UPDATE "user" SET role = 'client', "clientCompanyId" = $2, "mustChangePassword" = false WHERE id = $1`,
    [revoked.id, ids.clientCompanyId]
  );
  await authPool.query('DELETE FROM session WHERE "userId" = $1', [revoked.id]);

  const anonymous = await send(request, "POST", "anonymous", {
    body: uploadBody(bugId),
    key: false,
  });
  const staffRequest = await send(request, "POST", "owner", {
    body: uploadBody(bugId),
    key: false,
  });
  const revokedRequest = await send(request, "POST", "client", {
    body: uploadBody(bugId),
    key: false,
    token: revoked.bearerToken,
  });
  const staffFinalize = await send(finalize, "POST", "admin", {
    body: { bugId },
    params: { uploadIntentId: unknown },
  });
  const staffList = await send(list, "GET", "owner", { query: { bugId } });
  const staffDownload = await send(download, "GET", "admin", {
    params: { fileId: unknown },
  });
  const invalid = await send(request, "POST", "client", {
    body: { bugId: "nope", contentType: "bad", fileName: "", sizeBytes: 0 },
    key: false,
  });
  const noKey = await send(finalize, "POST", "client", {
    body: { bugId },
    key: false,
    params: { uploadIntentId: unknown },
  });

  expect(anonymous.status).toBe(401);
  expect(revokedRequest.status).toBe(401);
  expect(staffRequest.status).toBe(403);
  expect(staffFinalize.status).toBe(403);
  expect(staffList.status).toBe(403);
  expect(staffDownload.status).toBe(403);
  expect(invalid.status).toBe(422);
  expect(invalid.body.error.fieldErrors).toMatchObject({
    bugId: expect.any(String),
    contentType: expect.any(String),
    fileName: expect.any(String),
    sizeBytes: expect.any(String),
  });
  expect(noKey.status).toBe(422);
});
