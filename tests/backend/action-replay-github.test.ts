import { afterAll, beforeAll, expect, it } from "bun:test";

import {
  authPool,
  callAs,
  ids,
  personaId,
  replay,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import { refreshes } from "./support/next-cache-mock";

const githubActions = await import("../../features/github/github-actions");
const githubQueries = await import("../../features/github/github-queries");

let connectionId = "";

beforeAll(setupHarness);
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

it("creates a connection, shows the secret once and never lists it again", async () => {
  const refreshesBefore = refreshes.count;
  const created = await callAs(
    "admin",
    githubActions.createGithubConnectionAction,
    {
      autoCompleteOnMerge: true,
      projectId: ids.projectId,
      repoFullName: "Acme/Harness-Repo",
    }
  );
  if (!created.ok) {
    throw new Error(`Creating the connection failed: ${created.error.message}`);
  }
  connectionId = created.data.connection.id;
  expect(created.data.secret.startsWith("whsec_")).toBe(true);
  expect(created.data.connection.repoFullName).toBe("acme/harness-repo");
  expect(refreshes.count).toBeGreaterThan(refreshesBefore);
  const listed = await callAs("admin", githubQueries.listGithubConnections, {});
  expect(listed.ok).toBe(true);
  expect(JSON.stringify(listed)).not.toContain(created.data.secret);
});

it("reports field errors for a malformed repository and a duplicate", async () => {
  const malformed = await callAs(
    "admin",
    githubActions.createGithubConnectionAction,
    {
      autoCompleteOnMerge: false,
      projectId: ids.projectId,
      repoFullName: "not a repo",
    }
  );
  expect(malformed).toMatchObject({
    error: { code: "VALIDATION_FAILED" },
    ok: false,
  });
  const duplicate = await callAs(
    "admin",
    githubActions.createGithubConnectionAction,
    {
      autoCompleteOnMerge: false,
      projectId: ids.projectId,
      repoFullName: "acme/harness-repo",
    }
  );
  expect(duplicate).toMatchObject({ error: { code: "CONFLICT" }, ok: false });
});

it("rotates the secret to a new value", async () => {
  const rotated = await callAs(
    "admin",
    githubActions.rotateGithubSecretAction,
    {
      connectionId,
    }
  );
  if (!rotated.ok) {
    throw new Error(rotated.error.message);
  }
  expect(rotated.data.secret.startsWith("whsec_")).toBe(true);
});

it("replays an update without acting twice", async () => {
  await replay(
    "updateGithubConnectionAction",
    "admin",
    githubActions.updateGithubConnectionAction,
    { autoCompleteOnMerge: false, connectionId, enabled: false }
  );
  const row = await authPool.query<{
    autoCompleteOnMerge: boolean;
    enabled: boolean;
  }>(
    'SELECT enabled, "autoCompleteOnMerge" FROM github_connection WHERE id = $1',
    [connectionId]
  );
  expect(row.rows[0]).toEqual({ autoCompleteOnMerge: false, enabled: false });
  const activity = await authPool.query(
    "SELECT 1 FROM activity WHERE action = 'github.updated' AND details->>'connectionId' = $1",
    [connectionId]
  );
  expect(activity.rowCount).toBe(1);
});
