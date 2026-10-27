import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import {
  authPool,
  ids,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import {
  PNG_BYTES,
  insertFile,
  putToTicket,
  removeTaskObjects,
  submitBug,
} from "./support/mobile-attachments-fixtures";
import type { UploadTicketReply } from "./support/mobile-attachments-fixtures";
import {
  linkProjectToCompanies,
  send,
  setHandlers,
} from "./support/mobile-bugs-fixtures";

const touchedTasks: string[] = [];

beforeAll(async () => {
  await setupHarness();
  await linkProjectToCompanies();
  await setHandlers(ids.clientCompanyId, ["owner"]);
  await authPool.query(
    'UPDATE project SET "clientVisible" = true WHERE id = $1',
    [ids.projectId]
  );
  await authPool.query('UPDATE task SET "clientVisible" = true WHERE id = $1', [
    ids.taskId,
  ]);
});
afterAll(async () => {
  await removeTaskObjects(touchedTasks);
  await teardownHarness();
});

const downloadRoute = () =>
  import("../../app/api/v1/portal/attachments/[fileId]/download/route");
const staffDownloadRoute = () =>
  import("../../app/api/v1/workspace/attachments/[fileId]/download/route");

const seedApproval = async (
  fileId: string,
  status: "pending" | "cancelled" = "pending"
): Promise<string> => {
  const requestId = randomUUID();
  const cancelled = status === "cancelled";
  await authPool.query(
    `INSERT INTO approval_request (id, "projectId", "companyId", "taskId", "subjectKey", "subjectTitle", version, message, status, "requestedById", "requestedAt", "cancelledById", "cancelledAt")
     VALUES ($1, $2, $3, $4, $5, 'Design', 1, 'Please review.', $6, $7, now(), $8, $9)`,
    [
      requestId,
      ids.projectId,
      ids.clientCompanyId,
      ids.taskId,
      `task:${ids.taskId}:${requestId}`,
      status,
      personaId("owner"),
      cancelled ? personaId("owner") : null,
      cancelled ? new Date() : null,
    ]
  );
  await authPool.query(
    'INSERT INTO approval_request_file (id, "requestId", "fileId") VALUES ($1, $2, $3)',
    [randomUUID(), requestId, fileId]
  );
  return requestId;
};

it("opens a staff file attached to a visible approval, for its company only", async () => {
  const fileId = await insertFile(ids.taskId, "owner", "design.png");
  await seedApproval(fileId);
  const { GET } = await downloadRoute();

  const own = await send(GET, "GET", "client", { params: { fileId } });
  const foreign = await send(GET, "GET", "otherClient", {
    params: { fileId },
  });

  expect(own.status).toBe(200);
  expect(foreign.status).toBe(404);
});

it("stops serving an approval file once the request is cancelled", async () => {
  const fileId = await insertFile(ids.taskId, "owner", "withdrawn.png");
  const requestId = await seedApproval(fileId);
  const { GET } = await downloadRoute();

  const before = await send(GET, "GET", "client", { params: { fileId } });
  await authPool.query(
    `UPDATE approval_request SET status = 'cancelled', "cancelledById" = $2, "cancelledAt" = now() WHERE id = $1`,
    [requestId, personaId("owner")]
  );
  const after = await send(GET, "GET", "client", { params: { fileId } });

  expect(before.status).toBe(200);
  expect(after.status).toBe(404);
});

it("never serves a staff file that is on no approval or bug", async () => {
  const fileId = await insertFile(ids.taskId, "owner", "internal.png");
  const { GET } = await downloadRoute();

  const reply = await send(GET, "GET", "client", { params: { fileId } });

  expect(reply.status).toBe(404);
});

it("gives staff the evidence file id that the download route accepts", async () => {
  const { bugId, taskId } = await submitBug("client", "Evidence ids");
  touchedTasks.push(taskId);
  const { POST: request } =
    await import("../../app/api/v1/portal/attachments/uploads/route");
  const { POST: finalize } =
    await import("../../app/api/v1/portal/attachments/uploads/[uploadIntentId]/finalize/route");
  const ticketReply = await send(request, "POST", "client", {
    body: {
      bugId,
      contentType: "image/png",
      fileName: "evidence.png",
      sizeBytes: PNG_BYTES.byteLength,
    },
    key: false,
  });
  const ticket = ticketReply.body.data as UploadTicketReply;
  await putToTicket(ticket, PNG_BYTES);
  const done = await send(finalize, "POST", "client", {
    body: { bugId },
    params: { uploadIntentId: ticket.uploadIntentId },
  });
  const { GET: context } =
    await import("../../app/api/v1/workspace/bugs/[bugId]/route");
  const { GET: download } = await staffDownloadRoute();

  const detail = await send(context, "GET", "admin", { params: { bugId } });
  const evidence = detail.body.data.evidence as {
    file: { id: string } | null;
    uploadedBy: { name: string };
  }[];
  const link = await send(download, "GET", "admin", {
    params: { fileId: evidence[0]?.file?.id ?? "" },
  });

  expect(evidence).toHaveLength(1);
  expect(evidence[0]?.file?.id).toBe(done.body.data.fileId as string);
  expect(evidence[0]?.uploadedBy.name).toBe("Harness client");
  expect(link.status).toBe(200);
});
