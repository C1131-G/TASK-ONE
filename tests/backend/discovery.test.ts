import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import {
  DiscoveryManagement,
  DiscoveryManagementLive,
} from "../../src/server/preferences/discovery-management";

it("toggles personal favorites and keeps only recent non-empty searches", async () => {
  const userId = randomUUID();
  const projectId = randomUUID();
  const taskId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [userId, "Discovery Admin", `${userId}@discovery-test.example`, "admin"]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `D${userId.slice(0, 5)}`, "Discovery project"]
  );
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, "createdById") VALUES ($1, $2, $3, $4, $5)',
    [taskId, projectId, 1, "Discovery task", userId]
  );

  try {
    const program = Effect.gen(function* discover() {
      const discovery = yield* DiscoveryManagement;
      yield* discovery.toggleProjectFavorite(userId, projectId);
      yield* discovery.toggleTaskFavorite(userId, taskId);
      yield* discovery.addRecentSearch(userId, "  Website launch  ");
      yield* discovery.addRecentSearch(userId, " ");
      const saved = yield* discovery.listPersonalWorkspace(userId);
      const search = yield* discovery.searchWorkspace(userId, "Discovery");
      yield* discovery.toggleProjectFavorite(userId, projectId);
      yield* discovery.toggleTaskFavorite(userId, taskId);
      const removed = yield* discovery.listPersonalWorkspace(userId);
      return { removed, saved, search };
    });
    const result = await Effect.runPromise(
      Effect.provide(program, DiscoveryManagementLive)
    );

    expect(result.saved.projects.map(({ id }) => id)).toEqual([projectId]);
    expect(result.saved.tasks.map(({ id }) => id)).toEqual([taskId]);
    expect(result.saved.recentSearches).toEqual(["Website launch"]);
    expect(result.search.projects.map(({ id }) => id)).toEqual([projectId]);
    expect(result.search.tasks.map(({ id }) => id)).toEqual([taskId]);
    expect(result.removed.projects).toEqual([]);
    expect(result.removed.tasks).toEqual([]);
    expect(result.removed.recentSearches).toEqual([
      "Discovery",
      "Website launch",
    ]);
  } finally {
    await authPool.query("DELETE FROM task WHERE id = $1", [taskId]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [userId]);
  }
});

it("lists a favorite task whose project is not a favorite, and hides it once the project is archived", async () => {
  const userId = randomUUID();
  const projectId = randomUUID();
  const taskId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [userId, "Discovery Member", `${userId}@discovery-test.example`, "admin"]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `E${userId.slice(0, 5)}`, "Unstarred project"]
  );
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, "createdById") VALUES ($1, $2, $3, $4, $5)',
    [taskId, projectId, 1, "Starred task", userId]
  );

  try {
    const program = Effect.gen(function* discover() {
      const discovery = yield* DiscoveryManagement;
      yield* discovery.toggleTaskFavorite(userId, taskId);
      const listed = yield* discovery.listPersonalWorkspace(userId);
      yield* Effect.promise(() =>
        authPool.query(
          'UPDATE project SET "archivedAt" = now() WHERE id = $1',
          [projectId]
        )
      );
      const archived = yield* discovery.listPersonalWorkspace(userId);
      return { archived, listed };
    });
    const result = await Effect.runPromise(
      Effect.provide(program, DiscoveryManagementLive)
    );

    expect(result.listed.projects).toEqual([]);
    expect(result.listed.tasks.map(({ id }) => id)).toEqual([taskId]);
    expect(result.archived.tasks).toEqual([]);
  } finally {
    await authPool.query("DELETE FROM task WHERE id = $1", [taskId]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [userId]);
  }
});
