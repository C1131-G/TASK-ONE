import { afterAll, beforeAll, expect, it } from "bun:test";

import { ids, setupHarness, teardownHarness } from "./support/action-harness";
import {
  PNG_BYTES,
  evidenceCount,
  fileCount,
  intentCount,
  putToTicket,
  removeTaskObjects,
  submitBug,
} from "./support/mobile-attachments-fixtures";
import type { UploadTicketReply } from "./support/mobile-attachments-fixtures";
import {
  forceStatus,
  linkProjectToCompanies,
  send,
  setHandlers,
} from "./support/mobile-bugs-fixtures";

const MAX_FILES_PER_BUG = 10;
const PARALLEL_REQUESTS = 12;
const touchedTasks: string[] = [];

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
  import("../../app/api/v1/portal/attachments/uploads/route");
const finalizeRoute = () =>
  import("../../app/api/v1/portal/attachments/uploads/[uploadIntentId]/finalize/route");

const uploadBody = (bugId: string) => ({
  bugId,
  contentType: "image/png",
  fileName: "shot.png",
  sizeBytes: PNG_BYTES.byteLength,
});

it("refuses to finalize a file once its bug was closed after the ticket was issued", async () => {
  const { bugId, taskId } = await submitBug("client", "Closed mid-upload");
  touchedTasks.push(taskId);
  const { POST: request } = await uploadsRoute();
  const { POST: finalize } = await finalizeRoute();
  const ticketReply = await send(request, "POST", "client", {
    body: uploadBody(bugId),
    key: false,
  });
  expect(ticketReply.status).toBe(200);
  const ticket = ticketReply.body.data as UploadTicketReply;
  await putToTicket(ticket, PNG_BYTES);
  await forceStatus(bugId, "closed");

  const done = await send(finalize, "POST", "client", {
    body: { bugId },
    params: { uploadIntentId: ticket.uploadIntentId },
  });

  expect(done.status).toBe(403);
  expect(await fileCount(taskId)).toBe(0);
  expect(await evidenceCount(bugId)).toBe(0);
});

it("never issues more tickets than a bug can hold, even when they are requested together", async () => {
  const { bugId, taskId } = await submitBug("client", "Many at once");
  touchedTasks.push(taskId);
  const { POST: request } = await uploadsRoute();

  const replies = await Promise.all(
    Array.from({ length: PARALLEL_REQUESTS }, () =>
      send(request, "POST", "client", { body: uploadBody(bugId), key: false })
    )
  );

  // Exactly the cap: the rest are refused as over the limit, none fail for
  // any other reason.
  const statuses = replies.map(({ status }) => status);
  expect(statuses.filter((status) => status === 200)).toHaveLength(
    MAX_FILES_PER_BUG
  );
  expect(
    statuses.filter((status) => status !== 200 && status !== 422)
  ).toHaveLength(0);
  expect(await intentCount(taskId)).toBe(MAX_FILES_PER_BUG);
});
