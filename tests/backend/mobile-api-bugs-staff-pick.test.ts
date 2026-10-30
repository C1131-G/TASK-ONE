import { afterAll, beforeAll, expect, it } from "bun:test";

import {
  ids,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import {
  bugRow,
  countRows,
  linkProjectToCompanies,
  reportBody,
  send,
  setHandlers,
  versionOf,
} from "./support/mobile-bugs-fixtures";

beforeAll(async () => {
  await setupHarness();
  await linkProjectToCompanies();
  await setHandlers(ids.clientCompanyId, ["owner"]);
});
afterAll(teardownHarness);

const submitRoute = () => import("../../apps/web/app/api/v1/portal/bugs/route");
const pickRoute = () =>
  import("../../apps/web/app/api/v1/workspace/bugs/[bugId]/pick/route");

const submit = async (
  title: string,
  persona: "client" | "otherClient" = "client"
): Promise<string> => {
  const { POST } = await submitRoute();
  const reply = await send(POST, "POST", persona, {
    body: reportBody(title),
  });
  return reply.body.data.bugId as string;
};

const pickBody = (expectedVersion: number) => ({
  expectedVersion,
  priority: "high",
  severity: "major",
});

it("lets a designated handler pick up a client report", async () => {
  const bugId = await submit("Pick me");
  const { POST } = await pickRoute();
  const version = await versionOf(bugId);

  const reply = await send(POST, "POST", "owner", {
    body: pickBody(version),
    params: { bugId },
  });

  expect(reply.status).toBe(200);
  expect(reply.body.data).toMatchObject({ bugId, status: "triaged" });
  const row = await bugRow(bugId);
  expect(row.pickedById).toBe(personaId("owner"));
});

it("refuses a pickup from an employee who does not handle the company", async () => {
  const bugId = await submit("Not yours");
  const version = await versionOf(bugId);
  const { POST } = await pickRoute();

  const reply = await send(POST, "POST", "outsider", {
    body: pickBody(version),
    params: { bugId },
  });

  expect(reply.status).toBe(403);
  const row = await bugRow(bugId);
  expect(row.pickedById).toBeNull();
  expect(row.version).toBe(version);
});

it("gives exactly one of two simultaneous pickups the bug", async () => {
  await setHandlers(ids.clientCompanyId, ["owner", "outsider"]);
  const bugId = await submit("Race");
  const version = await versionOf(bugId);
  const { POST } = await pickRoute();

  const replies = await Promise.all(
    (["owner", "outsider"] as const).map((persona) =>
      send(POST, "POST", persona, {
        body: pickBody(version),
        params: { bugId },
      })
    )
  );

  expect(replies.map((reply) => reply.status).toSorted()).toEqual([200, 409]);
  const row = await bugRow(bugId);
  expect(row.version).toBeGreaterThan(version);
  expect(
    await countRows("activity", "\"taskId\" = $1 AND action = 'bug.picked'", [
      row.taskId,
    ])
  ).toBe(1);
});

it("refuses a missing, revoked or client token and changes nothing", async () => {
  const bugId = await submit("Token checks");
  const version = await versionOf(bugId);
  const { POST } = await pickRoute();

  const anonymous = await send(POST, "POST", "anonymous", {
    body: pickBody(version),
    params: { bugId },
  });
  const revoked = await send(POST, "POST", "owner", {
    body: pickBody(version),
    params: { bugId },
    token: "revoked-token",
  });
  const client = await send(POST, "POST", "client", {
    body: pickBody(version),
    params: { bugId },
  });

  expect(anonymous.status).toBe(401);
  expect(revoked.status).toBe(401);
  expect(client.status).toBe(403);
  const row = await bugRow(bugId);
  expect(row.pickedById).toBeNull();
  expect(row.version).toBe(version);
});

it("refuses a handler of one company picking another company's report", async () => {
  await setHandlers(ids.clientCompanyId, ["owner"]);
  const bugId = await submit("Another company's report", "otherClient");
  const before = await bugRow(bugId);
  const { POST } = await pickRoute();

  const reply = await send(POST, "POST", "owner", {
    body: pickBody(before.version),
    params: { bugId },
  });

  expect(reply.status).toBe(403);
  expect(await bugRow(bugId)).toEqual(before);
});

it("replays a retried pickup without picking or bumping twice", async () => {
  await setHandlers(ids.clientCompanyId, ["owner"]);
  const bugId = await submit("Pick retry");
  const version = await versionOf(bugId);
  const { POST } = await pickRoute();
  const key = "staff-pick-retry-key";

  const first = await send(POST, "POST", "owner", {
    body: pickBody(version),
    key,
    params: { bugId },
  });
  const afterFirst = await bugRow(bugId);
  const second = await send(POST, "POST", "owner", {
    body: pickBody(version),
    key,
    params: { bugId },
  });

  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(second.body.data).toEqual(first.body.data);
  expect(await bugRow(bugId)).toEqual(afterFirst);
  expect(
    await countRows("activity", "\"taskId\" = $1 AND action = 'bug.picked'", [
      afterFirst.taskId,
    ])
  ).toBe(1);
});

it("refuses the same key reused for a different pickup and changes nothing", async () => {
  await setHandlers(ids.clientCompanyId, ["owner"]);
  const bugId = await submit("Pick key reuse");
  const version = await versionOf(bugId);
  const { POST } = await pickRoute();
  const key = "staff-pick-reuse-key";

  const first = await send(POST, "POST", "owner", {
    body: pickBody(version),
    key,
    params: { bugId },
  });
  const afterFirst = await bugRow(bugId);
  const second = await send(POST, "POST", "owner", {
    body: { ...pickBody(version), priority: "low" },
    key,
    params: { bugId },
  });

  expect(first.status).toBe(200);
  expect(second.status).toBe(409);
  expect(await bugRow(bugId)).toEqual(afterFirst);
});

it("answers a stale version with a conflict and leaves the bug unchanged", async () => {
  await setHandlers(ids.clientCompanyId, ["owner"]);
  const bugId = await submit("Stale pickup");
  const version = await versionOf(bugId);
  const { POST } = await pickRoute();

  const reply = await send(POST, "POST", "owner", {
    body: pickBody(version + 5),
    params: { bugId },
  });

  expect(reply.status).toBe(409);
  const row = await bugRow(bugId);
  expect(row.version).toBe(version);
  expect(row.pickedById).toBeNull();
});
