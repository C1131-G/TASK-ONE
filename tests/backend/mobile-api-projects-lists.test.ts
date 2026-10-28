import { afterAll, beforeAll, expect, it } from "bun:test";

import { ids, setupHarness, teardownHarness } from "./support/action-harness";
import { linkProjectToCompanies } from "./support/mobile-bugs-fixtures";
import { send } from "./support/mobile-tasks-fixtures";

interface Row {
  readonly id: string;
}

interface Page {
  readonly items: readonly Row[];
  readonly nextCursor: string | null;
}

beforeAll(async () => {
  await setupHarness();
  await linkProjectToCompanies();
});
afterAll(teardownHarness);

const get = (path: string, as: "admin" | "client" | "outsider") =>
  send<Page>("GET", path, { as });

it("lists the active projects with counts and progress, and leaves out archived ones", async () => {
  const reply = await get("/api/v1/workspace/projects", "outsider");

  expect(reply.status).toBe(200);
  if (!reply.body.ok) {
    throw new Error("expected a page");
  }
  const rows = reply.body.data.items as readonly {
    id: string;
    key: string;
    name: string;
    openTaskCount: number;
    progress: number;
    status: string;
    taskCount: number;
  }[];
  const project = rows.find(({ id }) => id === ids.projectId);
  expect(project?.key).toBeTruthy();
  expect(project?.name).toBeTruthy();
  expect(typeof project?.taskCount).toBe("number");
  expect(rows.map(({ id }) => id)).not.toContain(ids.archivedProjectId);
});

it("pages the projects without repeating one", async () => {
  const first = await get("/api/v1/workspace/projects?limit=1", "admin");
  if (!first.body.ok) {
    throw new Error("expected a page");
  }
  expect(first.body.data.items).toHaveLength(1);

  const seen: string[] = [];
  let cursor: string | null = null;
  do {
    const query = `limit=1${cursor ? `&cursor=${cursor}` : ""}`;
    // eslint-disable-next-line no-await-in-loop
    const reply: Awaited<ReturnType<typeof get>> = await get(
      `/api/v1/workspace/projects?${query}`,
      "admin"
    );
    if (!reply.body.ok) {
      throw new Error("expected a page");
    }
    seen.push(...reply.body.data.items.map(({ id }) => id));
    cursor = reply.body.data.nextCursor;
  } while (cursor);

  expect(new Set(seen).size).toBe(seen.length);
});

it("lists the budgets, and answers a staff member who may not see them with the web's answer", async () => {
  const admin = await get("/api/v1/workspace/budgets", "admin");
  const staff = await get("/api/v1/workspace/budgets", "outsider");

  expect(admin.status).toBe(200);
  expect([200, 403]).toContain(staff.status);
});

it("lists only the projects shared with the client's company", async () => {
  const reply = await get("/api/v1/portal/projects", "client");

  expect(reply.status).toBe(200);
  if (!reply.body.ok) {
    throw new Error("expected a page");
  }
  const shared = reply.body.data.items.map(({ id }) => id);
  expect(shared).toContain(ids.projectId);
  expect(shared).not.toContain(ids.archivedProjectId);
});

it("keeps clients out of the workspace lists and staff out of the portal list", async () => {
  const projects = await get("/api/v1/workspace/projects", "client");
  const budgets = await get("/api/v1/workspace/budgets", "client");
  const portal = await get("/api/v1/portal/projects", "admin");
  const anonymous = await send("GET", "/api/v1/workspace/projects", {});

  expect([projects.status, budgets.status, portal.status]).toEqual([
    403, 403, 403,
  ]);
  expect(anonymous.status).toBe(401);
});

it("refuses a bad cursor and a bad limit", async () => {
  const badCursor = await get(
    "/api/v1/workspace/projects?cursor=bm90LWEtY3Vyc29y",
    "admin"
  );
  const zero = await get("/api/v1/workspace/projects?limit=0", "admin");

  expect([badCursor.status, zero.status]).toEqual([422, 422]);
});
