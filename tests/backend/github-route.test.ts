import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import {
  GithubConnections,
  GithubConnectionsLive,
} from "../../src/server/github/github-connections";
import { GITHUB_DELIVERY_RATE_LIMIT } from "../../src/server/github/github-rate-limit";
import { signGithubBody } from "../../src/server/github/github-signature";
import {
  authPool,
  ids,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

const { POST } =
  await import("../../apps/web/app/api/integrations/github/route");

const URL_PATH = "http://localhost/api/integrations/github";
const MAX_BODY_BYTES = 512 * 1024;
const SCRIPT_SCHEME = ["java", "script:"].join("");

interface Connection {
  readonly id: string;
  readonly repo: string;
  readonly secret: string;
}

const connect = async (
  autoCompleteOnMerge: boolean,
  projectId = ids.projectId
): Promise<Connection> => {
  const repo = `acme/r-${randomUUID().slice(0, 8)}`;
  const created = await Effect.runPromise(
    Effect.provide(
      Effect.gen(function* use() {
        const service = yield* GithubConnections;
        return yield* service.create(personaId("admin"), {
          autoCompleteOnMerge,
          projectId,
          repoFullName: repo,
        });
      }),
      GithubConnectionsLive
    )
  );
  return { id: created.connection.id, repo, secret: created.secret };
};

let projectKey = "";
let otherProjectId = "";
let otherProjectKey = "";
let manual: Connection;
let auto: Connection;
let disabled: Connection;
let nextNumber = 100;

const insertTask = async (
  projectId: string,
  options: { type?: string; status?: string; archived?: boolean } = {}
) => {
  nextNumber += 1;
  const id = randomUUID();
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, "createdById", type, status, "archivedAt", "archivedById") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [
      id,
      projectId,
      nextNumber,
      `Fixture ${nextNumber}`,
      personaId("owner"),
      options.type ?? "task",
      options.status ?? "todo",
      options.archived ? new Date() : null,
      options.archived ? personaId("owner") : null,
    ]
  );
  return { id, number: nextNumber };
};

beforeAll(async () => {
  await setupHarness();
  const project = await authPool.query<{ key: string }>(
    "SELECT key FROM project WHERE id = $1",
    [ids.projectId]
  );
  projectKey = project.rows[0]?.key ?? "";
  otherProjectId = randomUUID();
  otherProjectKey = `PX${otherProjectId.replaceAll("-", "").slice(0, 5).toUpperCase()}`;
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, 'Harness other mapped project')",
    [otherProjectId, otherProjectKey]
  );
  manual = await connect(false);
  auto = await connect(true);
  disabled = await connect(true);
  await authPool.query(
    "UPDATE github_connection SET enabled = false WHERE id = $1",
    [disabled.id]
  );
});

afterAll(async () => {
  await authPool.query(
    'DELETE FROM github_connection WHERE "createdById" = $1',
    [personaId("admin")]
  );
  await authPool.query(
    "DELETE FROM activity WHERE \"actorId\" = $1 AND action LIKE 'github.%'",
    [personaId("admin")]
  );
  await teardownHarness();
});

const pullPayload = (
  repo: string,
  overrides: {
    action?: string;
    number?: number;
    title?: string;
    body?: string | null;
    branch?: string;
    merged?: boolean;
    htmlUrl?: string;
  } = {}
) =>
  JSON.stringify({
    action: overrides.action ?? "opened",
    number: overrides.number ?? 1,
    pull_request: {
      body: overrides.body ?? null,
      head: { ref: overrides.branch ?? "feature/work" },
      html_url: overrides.htmlUrl ?? "https://example.invalid/not-used",
      merged: overrides.merged ?? false,
      number: overrides.number ?? 1,
      title: overrides.title ?? "A change",
      user: { login: "octocat" },
    },
    repository: { full_name: repo },
  });

interface Delivery {
  readonly body: string | Uint8Array<ArrayBuffer>;
  readonly event?: string | null;
  readonly id?: string | null;
  readonly secret: string;
  readonly signature?: string | null;
}

const bytesOf = (body: string | Uint8Array<ArrayBuffer>) =>
  typeof body === "string" ? new TextEncoder().encode(body) : body;

const send = async (delivery: Delivery) => {
  const bytes = bytesOf(delivery.body);
  const headers = new Headers({ "content-type": "application/json" });
  const signature =
    delivery.signature === undefined
      ? signGithubBody(delivery.secret, bytes)
      : delivery.signature;
  if (signature !== null) {
    headers.set("x-hub-signature-256", signature);
  }
  if (delivery.event !== null) {
    headers.set("x-github-event", delivery.event ?? "pull_request");
  }
  if (delivery.id !== null) {
    headers.set("x-github-delivery", delivery.id ?? randomUUID());
  }
  const response = await POST(
    new Request(URL_PATH, { body: bytes, headers, method: "POST" })
  );
  return {
    json: (await response.json()) as Record<string, unknown>,
    status: response.status,
  };
};

const linksFor = async (taskId: string) => {
  const result = await authPool.query<{
    authorLogin: string | null;
    prNumber: number;
    state: string;
    title: string;
    url: string;
  }>(
    'SELECT "prNumber", state, title, url, "authorLogin" FROM github_pull_link WHERE "taskId" = $1 ORDER BY "prNumber"',
    [taskId]
  );
  return result.rows;
};

const firstLink = async (taskId: string) => {
  const links = await linksFor(taskId);
  return links[0];
};

const firstState = async (taskId: string) => {
  const link = await firstLink(taskId);
  return link?.state;
};

const taskRow = async (taskId: string) => {
  const result = await authPool.query<{
    completedAt: Date | null;
    status: string;
    version: number;
  }>('SELECT status, "completedAt", version FROM task WHERE id = $1', [taskId]);
  return result.rows[0];
};

const statusOf = async (taskId: string) => {
  const row = await taskRow(taskId);
  return row?.status;
};

const versionOf = async (taskId: string) => {
  const row = await taskRow(taskId);
  return row?.version;
};

const countAll = async () => {
  const result = await authPool.query<{ count: string }>(
    "SELECT (SELECT count(*) FROM github_pull_link) + (SELECT count(*) FROM github_delivery) AS count"
  );
  return Number(result.rows[0]?.count);
};

it("refuses a delivery with no signature, a malformed one, or one made with another secret", async () => {
  const task = await insertTask(ids.projectId);
  const body = pullPayload(manual.repo, {
    title: `${projectKey}-${task.number} change`,
  });
  const before = await countAll();
  const missing = await send({ body, secret: manual.secret, signature: null });
  const malformed = await send({
    body,
    secret: manual.secret,
    signature: "sha256=nothex",
  });
  const wrongSecret = await send({ body, secret: "whsec_not-the-secret" });
  for (const refused of [missing, malformed, wrongSecret]) {
    expect(refused.status).toBe(401);
    expect(refused.json).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
  }
  expect(await linksFor(task.id)).toEqual([]);
  expect(await countAll()).toBe(before);
});

it("refuses a body that was altered after signing, including re-serialised JSON", async () => {
  const task = await insertTask(ids.projectId);
  const body = pullPayload(manual.repo, {
    title: `${projectKey}-${task.number} change`,
  });
  const signature = signGithubBody(manual.secret, bytesOf(body));
  const reserialised = JSON.stringify(JSON.parse(body), null, 2);
  const result = await send({
    body: reserialised,
    secret: manual.secret,
    signature,
  });
  expect(result.status).toBe(401);
  expect(await linksFor(task.id)).toEqual([]);
});

it("answers an unknown repository and a disabled connection exactly like a bad signature", async () => {
  const task = await insertTask(ids.projectId);
  const title = `${projectKey}-${task.number} change`;
  const unknown = await send({
    body: pullPayload("acme/never-connected", { title }),
    secret: manual.secret,
  });
  const off = await send({
    body: pullPayload(disabled.repo, { title }),
    secret: disabled.secret,
  });
  const bad = await send({
    body: pullPayload(manual.repo, { title }),
    secret: "wrong",
  });
  expect(unknown.status).toBe(401);
  expect(off.status).toBe(401);
  expect(unknown.json).toEqual(bad.json);
  expect(off.json).toEqual(bad.json);
  expect(await linksFor(task.id)).toEqual([]);
});

it("rejects an oversized body before verifying it", async () => {
  const declared = await POST(
    new Request(URL_PATH, {
      body: "{}",
      headers: {
        "content-length": String(MAX_BODY_BYTES + 1),
        "x-github-delivery": randomUUID(),
        "x-github-event": "pull_request",
        "x-hub-signature-256": "sha256=00",
      },
      method: "POST",
    })
  );
  expect(declared.status).toBe(413);
  const streamed = await send({
    body: new Uint8Array(MAX_BODY_BYTES + 1).fill(97),
    secret: manual.secret,
  });
  expect(streamed.status).toBe(413);
});

it("answers a signed ping without recording anything", async () => {
  const before = await countAll();
  const result = await send({
    body: JSON.stringify({ repository: { full_name: manual.repo }, zen: "x" }),
    event: "ping",
    secret: manual.secret,
  });
  expect(result).toMatchObject({ json: { status: "pong" }, status: 200 });
  expect(await countAll()).toBe(before);
});

it("requires a delivery id and a JSON body naming a repository", async () => {
  const noId = await send({
    body: pullPayload(manual.repo),
    id: null,
    secret: manual.secret,
  });
  expect(noId.status).toBe(400);
  const notJson = await send({ body: "not json", secret: manual.secret });
  expect(notJson.status).toBe(400);
  const noRepo = await send({ body: "{}", secret: manual.secret });
  expect(noRepo.status).toBe(400);
});

it("links an opened pull request by title, branch or body and builds the URL itself", async () => {
  const byTitle = await insertTask(ids.projectId);
  const byBranch = await insertTask(ids.projectId);
  const byBody = await insertTask(ids.projectId);
  const result = await send({
    body: pullPayload(manual.repo.toUpperCase(), {
      body: `Part of ${projectKey}-${byBody.number}.`,
      branch: `feature/${projectKey.toLowerCase()}-${byBranch.number}-thing`,
      htmlUrl: `${SCRIPT_SCHEME}alert(document.cookie)`,
      number: 7,
      title: `${projectKey}-${byTitle.number}: add the thing`,
    }),
    secret: manual.secret,
  });
  expect(result).toMatchObject({
    json: { linked: 3, status: "processed" },
    status: 200,
  });
  for (const task of [byTitle, byBranch, byBody]) {
    // oxlint-disable-next-line no-await-in-loop
    expect(await linksFor(task.id)).toEqual([
      {
        authorLogin: "octocat",
        prNumber: 7,
        state: "open",
        title: `${projectKey}-${byTitle.number}: add the thing`,
        url: `https://github.com/${manual.repo}/pull/7`,
      },
    ]);
    // oxlint-disable-next-line no-await-in-loop
    expect(await statusOf(task.id)).toBe("todo");
  }
});

it("takes each delivery id once, even when two arrive together", async () => {
  const task = await insertTask(ids.projectId);
  const id = randomUUID();
  const body = pullPayload(manual.repo, {
    number: 8,
    title: `${projectKey}-${task.number} dedupe`,
  });
  const results = await Promise.all([
    send({ body, id, secret: manual.secret }),
    send({ body, id, secret: manual.secret }),
  ]);
  expect(results.map(({ status }) => status)).toEqual([200, 200]);
  expect(results.map(({ json }) => json["status"]).toSorted()).toEqual([
    "duplicate",
    "processed",
  ]);
  const replayed = await send({ body, id, secret: manual.secret });
  expect(replayed.json).toMatchObject({ status: "duplicate" });
  expect(await linksFor(task.id)).toHaveLength(1);
});

it("keeps delivery ids separate between connections", async () => {
  const task = await insertTask(ids.projectId);
  const id = randomUUID();
  const body = pullPayload(auto.repo, {
    number: 9,
    title: `${projectKey}-${task.number} shared id`,
  });
  const first = await send({
    body: pullPayload(manual.repo, {
      number: 9,
      title: `${projectKey}-${task.number} shared id`,
    }),
    id,
    secret: manual.secret,
  });
  const second = await send({ body, id, secret: auto.secret });
  expect(first.json).toMatchObject({ status: "processed" });
  expect(second.json).toMatchObject({ status: "processed" });
  expect(await linksFor(task.id)).toHaveLength(2);
});

it("links nothing for another project's key, an unknown number or an archived task", async () => {
  const foreign = await insertTask(otherProjectId);
  const archived = await insertTask(ids.projectId, { archived: true });
  const result = await send({
    body: pullPayload(manual.repo, {
      number: 10,
      title: `${otherProjectKey}-${foreign.number} ${projectKey}-99999 ${projectKey}-${archived.number}`,
    }),
    secret: manual.secret,
  });
  expect(result).toMatchObject({
    json: { linked: 0, status: "processed" },
    status: 200,
  });
  expect(await linksFor(foreign.id)).toEqual([]);
  expect(await linksFor(archived.id)).toEqual([]);
});

it("stores a hostile title as inert plain text", async () => {
  const task = await insertTask(ids.projectId);
  const hostile = `${projectKey}-${task.number} <img src=x onerror=alert(1)>\u0000‮ <script>alert(2)</script>`;
  await send({
    body: pullPayload(manual.repo, { number: 11, title: hostile }),
    secret: manual.secret,
  });
  const [link] = await linksFor(task.id);
  expect(link?.title).toBe(
    `${projectKey}-${task.number} <img src=x onerror=alert(1)> <script>alert(2)</script>`
  );
  expect(link?.url).toBe(`https://github.com/${manual.repo}/pull/11`);
});

it("tracks title edits, closing and reopening", async () => {
  const task = await insertTask(ids.projectId);
  const key = `${projectKey}-${task.number}`;
  const base = { number: 12, secret: manual.secret };
  await send({
    ...base,
    body: pullPayload(manual.repo, { number: 12, title: `${key} first` }),
  });
  await send({
    ...base,
    body: pullPayload(manual.repo, {
      action: "edited",
      number: 12,
      title: `${key} renamed`,
    }),
  });
  expect(await firstLink(task.id)).toMatchObject({
    state: "open",
    title: `${key} renamed`,
  });
  await send({
    ...base,
    body: pullPayload(manual.repo, {
      action: "closed",
      number: 12,
      title: `${key} renamed`,
    }),
  });
  expect(await firstState(task.id)).toBe("closed");
  await send({
    ...base,
    body: pullPayload(manual.repo, {
      action: "reopened",
      number: 12,
      title: `${key} renamed`,
    }),
  });
  expect(await firstState(task.id)).toBe("open");
});

it("records a merge but leaves the task alone when auto-complete is off", async () => {
  const task = await insertTask(ids.projectId);
  await send({
    body: pullPayload(manual.repo, {
      action: "closed",
      merged: true,
      number: 13,
      title: `${projectKey}-${task.number} ship`,
    }),
    secret: manual.secret,
  });
  expect(await firstState(task.id)).toBe("merged");
  expect(await statusOf(task.id)).toBe("todo");
});

it("completes the task once on merge when auto-complete is on, with activity and notifications", async () => {
  const task = await insertTask(ids.projectId, { status: "progress" });
  await authPool.query(
    'INSERT INTO task_assignee ("taskId", "userId", "assignedById", "assignedAt") VALUES ($1, $2, $3, now())',
    [task.id, personaId("outsider"), personaId("owner")]
  );
  const body = pullPayload(auto.repo, {
    action: "closed",
    merged: true,
    number: 14,
    title: `${projectKey}-${task.number} ship`,
  });
  const first = await send({ body, secret: auto.secret });
  expect(first.json).toMatchObject({ completed: 1, status: "processed" });
  const done = await taskRow(task.id);
  expect(done).toMatchObject({ status: "done", version: 2 });
  expect(done?.completedAt).toBeInstanceOf(Date);

  const activity = await authPool.query<{
    actorId: string;
    details: { from: string; source: string; to: string };
  }>(
    'SELECT "actorId", details FROM activity WHERE "taskId" = $1 AND action = \'task.status_changed\'',
    [task.id]
  );
  expect(activity.rows).toHaveLength(1);
  expect(activity.rows[0]?.actorId).toBe(personaId("admin"));
  expect(activity.rows[0]?.details).toMatchObject({
    from: "progress",
    source: "github",
    to: "done",
  });
  const notified = await authPool.query<{ userId: string }>(
    'SELECT "userId" FROM notification WHERE "taskId" = $1 AND type = \'status\'',
    [task.id]
  );
  expect(notified.rows.map(({ userId }) => userId).toSorted()).toEqual(
    [personaId("owner"), personaId("outsider")].toSorted()
  );

  // A fresh delivery id for the same merge must change nothing further.
  const again = await send({ body, secret: auto.secret });
  expect(again.json).toMatchObject({ completed: 0, status: "processed" });
  expect(await versionOf(task.id)).toBe(2);
  const activityAfter = await authPool.query(
    "SELECT 1 FROM activity WHERE \"taskId\" = $1 AND action = 'task.status_changed'",
    [task.id]
  );
  expect(activityAfter.rowCount).toBe(1);
});

it("does not override a task that a person reopened after the merge", async () => {
  const task = await insertTask(ids.projectId);
  const body = pullPayload(auto.repo, {
    action: "closed",
    merged: true,
    number: 15,
    title: `${projectKey}-${task.number} ship`,
  });
  await send({ body, secret: auto.secret });
  await authPool.query(
    "UPDATE task SET status = 'todo', \"completedAt\" = NULL, version = version + 1 WHERE id = $1",
    [task.id]
  );
  await send({ body, secret: auto.secret });
  expect(await statusOf(task.id)).toBe("todo");
});

it("never auto-completes a task that is already done, a bug, or recurring", async () => {
  const finished = await insertTask(ids.projectId, { status: "done" });
  const bug = await insertTask(ids.projectId, { type: "bug" });
  const recurring = await insertTask(ids.projectId);
  await authPool.query(
    'INSERT INTO task_recurrence (id, "taskId", frequency, "interval", "nextRunAt", "createdAt", "updatedAt") VALUES ($1, $2, \'weekly\', 1, \'2026-12-01\', now(), now())',
    [randomUUID(), recurring.id]
  );
  const result = await send({
    body: pullPayload(auto.repo, {
      action: "closed",
      merged: true,
      number: 16,
      title: `${[finished, bug, recurring]
        .map(({ number }) => `${projectKey}-${number}`)
        .join(" ")} ship`,
    }),
    secret: auto.secret,
  });
  expect(result.json).toMatchObject({ completed: 0, linked: 3 });
  expect(await versionOf(finished.id)).toBe(1);
  expect(await statusOf(bug.id)).toBe("todo");
  expect(await statusOf(recurring.id)).toBe("todo");
  await authPool.query('DELETE FROM task_recurrence WHERE "taskId" = $1', [
    recurring.id,
  ]);
});

it("acknowledges event types it does not use without recording links", async () => {
  const task = await insertTask(ids.projectId);
  const result = await send({
    body: pullPayload(manual.repo, {
      number: 17,
      title: `${projectKey}-${task.number}`,
    }),
    event: "push",
    secret: manual.secret,
  });
  expect(result).toMatchObject({ json: { status: "ignored" }, status: 200 });
  expect(await linksFor(task.id)).toEqual([]);
});

it("ignores actions that carry no pull request change", async () => {
  const task = await insertTask(ids.projectId);
  const result = await send({
    body: pullPayload(manual.repo, {
      action: "synchronize",
      number: 18,
      title: `${projectKey}-${task.number}`,
    }),
    secret: manual.secret,
  });
  expect(result.json).toMatchObject({ status: "ignored" });
  expect(await linksFor(task.id)).toEqual([]);
});

const postFrom = (ip: string) =>
  POST(
    new Request(URL_PATH, {
      body: "{}",
      headers: { "x-forwarded-for": ip },
      method: "POST",
    })
  );

it("throttles one client address before checking any signature", async () => {
  for (let count = 0; count < GITHUB_DELIVERY_RATE_LIMIT; count += 1) {
    // eslint-disable-next-line no-await-in-loop
    const accepted = await postFrom("203.0.113.50");
    expect(accepted.status).toBe(400);
  }
  const limited = await postFrom("203.0.113.50");
  expect(limited.status).toBe(429);
  expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  const otherClient = await postFrom("203.0.113.51");
  expect(otherClient.status).toBe(400);
});
