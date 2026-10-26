import { afterAll, beforeAll, expect, it } from "bun:test";

import { setupHarness, teardownHarness } from "./support/action-harness";
import {
  bugRow,
  linkProjectToCompanies,
  reportBody,
  send,
} from "./support/mobile-bugs-fixtures";

beforeAll(async () => {
  await setupHarness();
  await linkProjectToCompanies();
});
afterAll(teardownHarness);

const submitRoute = () => import("../../app/api/v1/portal/bugs/route");

it("lets a client submit a bug report and records it for their company", async () => {
  const { POST } = await submitRoute();

  const reply = await send(POST, "POST", "client", { body: reportBody() });

  expect(reply.status).toBe(200);
  expect(reply.body.data.version).toBe(1);
  const row = await bugRow(reply.body.data.bugId);
  expect(row.status).toBe("reported");
  expect(row.clientCompanyId).not.toBeNull();
});

const listRoute = () => import("../../app/api/v1/portal/bugs/route");
const detailRoute = () => import("../../app/api/v1/portal/bugs/[bugId]/route");

const submit = async (
  persona: "client" | "otherClient" = "client",
  title = "Mobile report"
): Promise<{ bugId: string; version: number }> => {
  const { POST } = await submitRoute();
  const reply = await send(POST, "POST", persona, { body: reportBody(title) });
  if (reply.status !== 200) {
    throw new Error(JSON.stringify(reply.body));
  }
  return reply.body.data;
};

it("refuses a submission with fieldErrors that name each bad field", async () => {
  const { POST } = await submitRoute();

  const reply = await send(POST, "POST", "client", {
    body: { ...reportBody(), reproductionSteps: [], title: "   " },
  });

  expect(reply.status).toBe(422);
  expect(reply.body.error.code).toBe("VALIDATION_FAILED");
  expect(Object.keys(reply.body.error.fieldErrors ?? {})).toEqual(
    expect.arrayContaining(["title", "reproductionSteps"])
  );
});

it("lists only the signed-in client's own company reports", async () => {
  const mine = await submit("client", "Company A report");
  const theirs = await submit("otherClient", "Company B report");
  const { GET } = await listRoute();

  const reply = await send(GET, "GET", "client");

  const listed = (reply.body.data as { id: string }[]).map(({ id }) => id);
  expect(reply.status).toBe(200);
  expect(listed).toContain(mine.bugId);
  expect(listed).not.toContain(theirs.bugId);
});

it("shows another company's report as missing without confirming it exists", async () => {
  const theirs = await submit("otherClient", "Hidden from A");
  const { GET } = await detailRoute();

  const reply = await send(GET, "GET", "client", {
    params: { bugId: theirs.bugId },
  });
  const unknown = await send(GET, "GET", "client", {
    params: { bugId: "00000000-0000-4000-8000-000000000000" },
  });

  expect(reply.status).toBe(404);
  expect(reply.body.error.message).toBe(unknown.body.error.message);
  expect(JSON.stringify(reply.body)).not.toContain(theirs.bugId);
});

it("returns the client view of a report with no staff-only fields", async () => {
  const mine = await submit("client", "Client view");
  const { GET } = await detailRoute();

  const reply = await send(GET, "GET", "client", {
    params: { bugId: mine.bugId },
  });

  expect(reply.status).toBe(200);
  expect(reply.body.data).toMatchObject({
    id: mine.bugId,
    status: "submitted",
    title: "Client view",
  });
  for (const hidden of [
    "severity",
    "priority",
    "pickedById",
    "assignee",
    "clientContext",
    "internal",
  ]) {
    expect(JSON.stringify(reply.body.data)).not.toContain(`"${hidden}"`);
  }
});

it("answers 401 without a token and 403 for a staff token on a portal route", async () => {
  const { GET } = await listRoute();

  const anonymous = await send(GET, "GET", "anonymous");
  const revoked = await send(GET, "GET", "client", { token: "revoked-token" });
  const staff = await send(GET, "GET", "owner");
  const admin = await send(GET, "GET", "admin");

  expect(anonymous.status).toBe(401);
  expect(revoked.status).toBe(401);
  expect(staff.status).toBe(403);
  expect(admin.status).toBe(403);
});

it("does not submit twice when the same key is retried", async () => {
  const { POST } = await submitRoute();
  const key = "portal-submit-retry-key";

  const first = await send(POST, "POST", "client", {
    body: reportBody("Retry once"),
    key,
  });
  const second = await send(POST, "POST", "client", {
    body: reportBody("Retry once"),
    key,
  });

  expect(second.body.data).toEqual(first.body.data);
  const { countRows } = await import("./support/mobile-bugs-fixtures");
  expect(await countRows("task", "title = $1", ["Retry once"])).toBe(1);
});

it("refuses the same key reused for a different report and creates nothing", async () => {
  const { POST } = await submitRoute();
  const key = "portal-submit-reuse-key";
  await send(POST, "POST", "client", { body: reportBody("Reuse A"), key });

  const reply = await send(POST, "POST", "client", {
    body: reportBody("Reuse B"),
    key,
  });

  expect(reply.status).toBe(409);
  const { countRows } = await import("./support/mobile-bugs-fixtures");
  expect(await countRows("task", "title = $1", ["Reuse B"])).toBe(0);
});

it("asks for an Idempotency-Key on every write", async () => {
  const { POST } = await submitRoute();

  const reply = await send(POST, "POST", "client", {
    body: reportBody("No key"),
    key: false,
  });

  expect(reply.status).toBe(422);
  expect(reply.body.error.fieldErrors).toHaveProperty("Idempotency-Key");
});

it("answers in exactly the shapes the route list declares", async () => {
  const { Schema } = await import("effect");
  const { portalBugRoutes } = await import("../../src/mobile-api/routes-bugs");
  const mine = await submit("client", "Shape check");
  const { GET } = await detailRoute();
  const list = await listRoute();

  const detail = await send(GET, "GET", "client", {
    params: { bugId: mine.bugId },
  });
  const listed = await send(list.GET, "GET", "client");

  expect(() =>
    Schema.decodeUnknownSync(portalBugRoutes.detail.data)(detail.body.data)
  ).not.toThrow();
  expect(() =>
    Schema.decodeUnknownSync(portalBugRoutes.list.data)(listed.body.data)
  ).not.toThrow();
  expect(() =>
    Schema.decodeUnknownSync(portalBugRoutes.submit.data)(mine)
  ).not.toThrow();
});
