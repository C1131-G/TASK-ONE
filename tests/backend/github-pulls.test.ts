import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import {
  authPool,
  callAs,
  ids,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";

const queries = await import("../../features/github/github-queries");

let connectionId = "";

beforeAll(async () => {
  await setupHarness();
  connectionId = randomUUID();
  await authPool.query(
    'INSERT INTO github_connection (id, "repoFullName", "projectId", "secretCiphertext", "secretHint", "createdById") VALUES ($1, $2, $3, $4, $5, $6)',
    [
      connectionId,
      `acme/pulls-${connectionId.slice(0, 8)}`,
      ids.projectId,
      "unused",
      "1234",
      personaId("admin"),
    ]
  );
  const insert = (number: number, title: string, state: string, at: string) =>
    authPool.query(
      'INSERT INTO github_pull_link (id, "connectionId", "taskId", "prNumber", title, url, state, "authorLogin", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [
        randomUUID(),
        connectionId,
        ids.taskId,
        number,
        title,
        `https://github.com/acme/pulls/pull/${number}`,
        state,
        "octocat",
        at,
      ]
    );
  await insert(1, "<script>alert(1)</script> older", "closed", "2026-10-01");
  await insert(2, "Newest change", "open", "2026-10-20");
});

afterAll(async () => {
  await authPool.query("DELETE FROM github_connection WHERE id = $1", [
    connectionId,
  ]);
  await teardownHarness();
});

it("lists a task's pull requests for staff, newest first, with titles as plain text", async () => {
  for (const persona of ["owner", "outsider", "admin"] as const) {
    // oxlint-disable-next-line no-await-in-loop
    const result = await callAs(persona, queries.getTaskLinkedPulls, {
      taskId: ids.taskId,
    });
    if (!result.ok) {
      throw new Error(`${persona}: ${result.error.message}`);
    }
    expect(result.data.map(({ number }) => number)).toEqual([2, 1]);
    expect(result.data[1]).toMatchObject({
      authorLogin: "octocat",
      state: "closed",
      title: "<script>alert(1)</script> older",
      url: "https://github.com/acme/pulls/pull/1",
    });
  }
});

it("returns nothing to clients, anonymous callers or deactivated accounts", async () => {
  for (const persona of [
    "client",
    "coworker",
    "otherClient",
    "anonymous",
    "deactivated",
  ] as const) {
    // oxlint-disable-next-line no-await-in-loop
    const result = await callAs(persona, queries.getTaskLinkedPulls, {
      taskId: ids.taskId,
    });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("Newest change");
  }
});

it("reports a missing task and rejects a malformed id", async () => {
  const missing = await callAs("owner", queries.getTaskLinkedPulls, {
    taskId: randomUUID(),
  });
  expect(missing).toMatchObject({ error: { code: "NOT_FOUND" }, ok: false });
  const malformed = await callAs("owner", queries.getTaskLinkedPulls, {
    taskId: "nope",
  });
  expect(malformed.ok).toBe(false);
});
