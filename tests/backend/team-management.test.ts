import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import {
  TeamManagement,
  TeamManagementLive,
} from "../../src/server/people/team-management";

it("lets admins create, edit, list, and remove a team", async () => {
  const administratorId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [
      administratorId,
      "Team Admin",
      `${administratorId}@teams-test.example`,
      "admin",
    ]
  );

  try {
    const program = Effect.gen(function* manageTeam() {
      const teams = yield* TeamManagement;
      const created = yield* teams.createTeam(administratorId, {
        color: "#336699",
        description: "Initial description",
        name: "Design team",
      });
      const updated = yield* teams.updateTeam(administratorId, created.id, {
        color: "#663399",
        description: "Updated description",
        name: "Studio Design",
      });
      const listed = yield* teams.listTeams(administratorId);
      yield* teams.deleteTeam(administratorId, created.id);
      const afterDelete = yield* teams.listTeams(administratorId);
      return { afterDelete, listed, updated };
    });
    const result = await Effect.runPromise(
      Effect.provide(program, TeamManagementLive)
    );

    expect(result.updated).toMatchObject({
      color: "#663399",
      description: "Updated description",
      name: "Studio Design",
    });
    expect(result.listed.some(({ id }) => id === result.updated.id)).toBe(true);
    expect(result.afterDelete.some(({ id }) => id === result.updated.id)).toBe(
      false
    );
  } finally {
    await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [
      administratorId,
    ]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [administratorId]);
  }
});
