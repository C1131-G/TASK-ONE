import { afterAll, beforeAll, expect, it } from "bun:test";

import { ids, setupHarness, teardownHarness } from "./support/action-harness";
import { send } from "./support/mobile-tasks-fixtures";

interface Page {
  readonly items: readonly { readonly id: string }[];
  readonly nextCursor: string | null;
}

beforeAll(setupHarness);
afterAll(teardownHarness);

const get = (path: string, as: "admin" | "client" | "outsider") =>
  send<Page>("GET", path, { as });

const idsOf = async (
  path: string,
  as: "admin" | "outsider" = "admin"
): Promise<string[]> => {
  const reply = await get(path, as);
  expect(reply.status).toBe(200);
  if (!reply.body.ok) {
    throw new Error("expected a page");
  }
  return reply.body.data.items.map(({ id }) => id);
};

const walk = async (path: string): Promise<string[]> => {
  const seen: string[] = [];
  let cursor: string | null = null;
  do {
    const query = `limit=1${cursor ? `&cursor=${cursor}` : ""}`;
    const joiner = path.includes("?") ? "&" : "?";
    // eslint-disable-next-line no-await-in-loop
    const reply: Awaited<ReturnType<typeof get>> = await get(
      `${path}${joiner}${query}`,
      "admin"
    );
    if (!reply.body.ok) {
      throw new Error("expected a page");
    }
    seen.push(...reply.body.data.items.map(({ id }) => id));
    cursor = reply.body.data.nextCursor;
  } while (cursor);
  return seen;
};

it("lists the employees with their team and counts, and narrows them by a search text", async () => {
  const everyone = await idsOf("/api/v1/workspace/members");
  const reply = await get("/api/v1/workspace/members", "admin");
  if (!reply.body.ok) {
    throw new Error("expected a page");
  }
  const first = reply.body.data.items[0] as unknown as Record<string, unknown>;
  const none = await idsOf("/api/v1/workspace/members?q=zzqx-nobody-has-this");

  expect(everyone).toContain(ids.employeeId);
  expect(typeof first["employeeId"]).toBe("string");
  expect(typeof first["openAssignedTaskCount"]).toBe("number");
  expect(none).toEqual([]);
});

it("lists the teams", async () => {
  const reply = await get("/api/v1/workspace/teams", "admin");

  expect(reply.status).toBe(200);
  if (!reply.body.ok) {
    throw new Error("expected a page");
  }
  expect(Array.isArray(reply.body.data.items)).toBe(true);
});

it("lists the client companies with both test companies", async () => {
  const listed = await idsOf("/api/v1/workspace/clients");

  expect(listed).toContain(ids.clientCompanyId);
  expect(listed).toContain(ids.otherClientCompanyId);
});

it("pages every directory without repeating a row", async () => {
  for (const path of [
    "/api/v1/workspace/members",
    "/api/v1/workspace/teams",
    "/api/v1/workspace/clients",
  ]) {
    // eslint-disable-next-line no-await-in-loop
    const paged = await walk(path);
    // eslint-disable-next-line no-await-in-loop
    const whole = await idsOf(`${path}?limit=100`);

    expect(paged).toEqual(whole);
    expect(new Set(paged).size).toBe(paged.length);
  }
});

it("keeps clients out and answers 401 without a session", async () => {
  const paths = [
    "/api/v1/workspace/members",
    "/api/v1/workspace/teams",
    "/api/v1/workspace/clients",
  ];
  for (const path of paths) {
    // eslint-disable-next-line no-await-in-loop
    const client = await get(path, "client");
    // eslint-disable-next-line no-await-in-loop
    const anonymous = await send("GET", path, {});

    expect([client.status, anonymous.status]).toEqual([403, 401]);
  }
});

it("answers a staff member without admin rights as the web does", async () => {
  const members = await get("/api/v1/workspace/members", "outsider");
  const teams = await get("/api/v1/workspace/teams", "outsider");
  const clients = await get("/api/v1/workspace/clients", "outsider");

  expect([members.status, teams.status]).toEqual([200, 200]);
  expect([200, 403]).toContain(clients.status);
});

it("refuses a bad cursor", async () => {
  const reply = await get(
    "/api/v1/workspace/teams?cursor=bm90LWEtY3Vyc29y",
    "admin"
  );

  expect(reply.status).toBe(422);
});
