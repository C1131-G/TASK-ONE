import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import { runEffectResult } from "../../src/server/core/action-result";
import { ProjectManagement } from "../../src/server/projects/project-contracts";
import { ProjectManagementLive } from "../../src/server/projects/project-management";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

interface Fixture {
  readonly adminId: string;
  readonly memberIds: readonly string[];
  readonly projectId: string;
}

const seedFixture = async (): Promise<Fixture> => {
  const adminId = randomUUID();
  const memberIds = [randomUUID(), randomUUID(), randomUUID()];
  const projectId = randomUUID();
  const suffix = projectId.replaceAll("-", "").slice(0, 6).toUpperCase();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'admin\', false)',
    [adminId, "Project Concurrency Admin", `${adminId}@project-conc.example`]
  );
  await Promise.all(
    memberIds.map((memberId) =>
      authPool.query(
        'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
        [memberId, "Project Member", `${memberId}@project-conc.example`]
      )
    )
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `PC${suffix}`, "Project concurrency"]
  );
  return { adminId, memberIds, projectId };
};

const removeFixture = async ({ adminId, memberIds, projectId }: Fixture) => {
  await authPool.query('DELETE FROM activity WHERE "projectId" = $1', [
    projectId,
  ]);
  await authPool.query('DELETE FROM project_member WHERE "projectId" = $1', [
    projectId,
  ]);
  await authPool.query('DELETE FROM project_milestone WHERE "projectId" = $1', [
    projectId,
  ]);
  await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
  await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [adminId]);
  await authPool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [
    [adminId, ...memberIds],
  ]);
};

const projectVersion = async (projectId: string): Promise<number> => {
  const rows = await authPool.query(
    "SELECT version FROM project WHERE id = $1",
    [projectId]
  );
  return rows.rows[0]?.version;
};

it("lets exactly one of two concurrent project-people updates win and keeps its members", async () => {
  const fixture = await seedFixture();
  const [first, second, third] = fixture.memberIds;
  try {
    const version = await projectVersion(fixture.projectId);
    const assign = (leadId: string, memberIds: string[]) =>
      runEffectResult(
        Effect.provide(
          Effect.gen(function* assignPeople() {
            const projects = yield* ProjectManagement;
            return yield* projects.setProjectPeople(
              fixture.adminId,
              fixture.projectId,
              version,
              { leadId, memberIds }
            );
          }),
          ProjectManagementLive
        )
      );
    const outcomes = await Promise.all([
      assign(first ?? "", [first ?? "", second ?? ""]),
      assign(third ?? "", [third ?? ""]),
    ]);

    const succeeded = outcomes.filter((outcome) => outcome.ok);
    const rejected = outcomes.filter((outcome) => !outcome.ok);
    expect(succeeded).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({
      error: { code: "CONFLICT" },
      ok: false,
    });

    const [winner] = succeeded;
    const stored = await authPool.query(
      'SELECT "userId" FROM project_member WHERE "projectId" = $1 ORDER BY "userId"',
      [fixture.projectId]
    );
    const storedIds = stored.rows.map((row) => row.userId).toSorted();
    const winnerIds = winner?.ok ? [...winner.data.memberIds].toSorted() : [];
    expect(storedIds).toEqual(winnerIds);
    expect(await projectVersion(fixture.projectId)).toBe(version + 1);
  } finally {
    await removeFixture(fixture);
  }
});

it("lets exactly one of two concurrent milestone saves win and keeps its milestones", async () => {
  const fixture = await seedFixture();
  try {
    const version = await projectVersion(fixture.projectId);
    const save = (names: string[]) =>
      runEffectResult(
        Effect.provide(
          Effect.gen(function* saveMilestones() {
            const projects = yield* ProjectManagement;
            return yield* projects.saveProjectMilestones(
              fixture.adminId,
              fixture.projectId,
              version,
              names.map((name) => ({
                completed: false,
                dueDate: null,
                id: null,
                name,
              }))
            );
          }),
          ProjectManagementLive
        )
      );
    const outcomes = await Promise.all([
      save(["Alpha", "Beta"]),
      save(["Gamma"]),
    ]);

    const succeeded = outcomes.filter((outcome) => outcome.ok);
    const rejected = outcomes.filter((outcome) => !outcome.ok);
    expect(succeeded).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({
      error: { code: "CONFLICT" },
      ok: false,
    });

    const [winner] = succeeded;
    const stored = await authPool.query(
      'SELECT name FROM project_milestone WHERE "projectId" = $1 ORDER BY position',
      [fixture.projectId]
    );
    const storedNames = stored.rows.map((row) => row.name);
    const winnerNames = winner?.ok
      ? winner.data.milestones.map((milestone) => milestone.name)
      : [];
    expect(storedNames).toEqual(winnerNames);
    expect(await projectVersion(fixture.projectId)).toBe(version + 1);
  } finally {
    await removeFixture(fixture);
  }
});
