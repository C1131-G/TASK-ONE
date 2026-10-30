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
  linkProjectToCompanies,
  reportBody,
  send,
  setHandlers,
} from "./support/mobile-bugs-fixtures";

beforeAll(async () => {
  await setupHarness();
  await linkProjectToCompanies();
  await setHandlers(ids.clientCompanyId, ["owner"]);
});
afterAll(teardownHarness);

const submitRoute = () => import("../../apps/web/app/api/v1/portal/bugs/route");
const detailRoute = () =>
  import("../../apps/web/app/api/v1/workspace/bugs/[bugId]/route");

const SCREENSHOT_BYTES = 2048;

// Evidence is uploaded by other branches' routes; here it is placed directly.
const addEvidence = async (bugId: string): Promise<string> => {
  const bug = await authPool.query<{ taskId: string }>(
    'SELECT "taskId" FROM bug_report WHERE id = $1',
    [bugId]
  );
  const fileId = randomUUID();
  const evidenceId = randomUUID();
  await authPool.query(
    'INSERT INTO file_asset (id, "projectId", "taskId", "uploadedById", "originalName", "storageKey", "contentType", "sizeBytes") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [
      fileId,
      ids.projectId,
      bug.rows[0]?.taskId,
      personaId("owner"),
      "crash.png",
      `bugs/${fileId}/crash.png`,
      "image/png",
      SCREENSHOT_BYTES,
    ]
  );
  await authPool.query(
    'INSERT INTO bug_evidence (id, "bugReportId", "fileAssetId", "uploadedById", kind, caption) VALUES ($1, $2, $3, $4, \'before\', $5)',
    [evidenceId, bugId, fileId, personaId("owner"), "The crash"]
  );
  return fileId;
};

it("lists a bug's evidence for staff with its file, type, size and uploader", async () => {
  const { POST } = await submitRoute();
  const submitted = await send(POST, "POST", "client", {
    body: reportBody("With evidence"),
  });
  const bugId = submitted.body.data.bugId as string;
  const fileId = await addEvidence(bugId);
  const { GET } = await detailRoute();

  const reply = await send(GET, "GET", "admin", { params: { bugId } });

  expect(reply.status).toBe(200);
  expect(reply.body.data.evidence).toMatchObject([
    {
      caption: "The crash",
      file: {
        contentType: "image/png",
        id: fileId,
        name: "crash.png",
        sizeBytes: SCREENSHOT_BYTES,
      },
      kind: "before",
      uploadedBy: { id: personaId("owner"), name: "Harness owner" },
    },
  ]);
  const { staffBugContextRoute } =
    await import("../../src/mobile-api/routes-bugs");
  expect(() =>
    Schema.decodeUnknownSync(staffBugContextRoute.data)(reply.body.data)
  ).not.toThrow();
});

it("keeps the evidence out of the client's portal read", async () => {
  const { POST } = await submitRoute();
  const submitted = await send(POST, "POST", "client", {
    body: reportBody("Evidence privacy"),
  });
  const bugId = submitted.body.data.bugId as string;
  await addEvidence(bugId);
  const detail =
    await import("../../apps/web/app/api/v1/portal/bugs/[bugId]/route");

  const reply = await send(detail.GET, "GET", "client", { params: { bugId } });

  expect(reply.status).toBe(200);
  expect(JSON.stringify(reply.body.data)).not.toContain("crash.png");
});
