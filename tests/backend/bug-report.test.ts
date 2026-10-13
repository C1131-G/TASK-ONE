import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import { authPool } from "../../src/server/auth/database";
import {
  BugManagement,
  BugManagementLive,
} from "../../src/server/work/bug-management";
import {
  WorkManagement,
  WorkManagementLive,
} from "../../src/server/work/work-management";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

it("reports a structured bug and returns it through the bug query", async () => {
  const actorId = randomUUID();
  const projectId = randomUUID();
  const suffix = randomUUID();
  const email = `${actorId}@bug-test.example`;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [actorId, "Bug Reporter", email, "employee"]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `B${suffix.slice(0, 6)}`, "Bug reporting test"]
  );

  try {
    const program = Effect.gen(function* reportAndRead() {
      const bugs = yield* BugManagement;
      const report = yield* bugs.reportBug(actorId, {
        actualBehavior: "The save button returns an error.",
        appVersion: "1.2.0",
        browser: "Firefox 132",
        component: "ProjectSettingsForm",
        description: "Saving an edited project name fails.",
        device: "Desktop",
        discoverySource: "internal_qa",
        environment: "staging",
        expectedBehavior: "The new name appears in the project header.",
        os: "Windows 11",
        projectId,
        reproductionSteps: [
          "Open project settings",
          "Change the name",
          "Select Save",
        ],
        route: "/projects/alpha/settings",
        severity: "major",
        title: "Project settings cannot be saved",
      });
      const queried = yield* bugs.getBug(actorId, report.id);
      const work = yield* WorkManagement;
      const drawerTasks = yield* work.listProjectTasks(actorId, projectId, {
        includeBugs: true,
        limit: 1,
        offset: 0,
        taskId: report.taskId,
      });
      return { drawerTask: drawerTasks[0], queried, report };
    });
    const result = await Effect.runPromise(
      Effect.provide(
        program,
        Layer.mergeAll(BugManagementLive, WorkManagementLive)
      )
    );

    expect(result.report).toMatchObject({
      actualBehavior: "The save button returns an error.",
      discoverySource: "internal_qa",
      environment: "staging",
      expectedBehavior: "The new name appears in the project header.",
      projectId,
      reproductionSteps: [
        "Open project settings",
        "Change the name",
        "Select Save",
      ],
      severity: "major",
      status: "reported",
      title: "Project settings cannot be saved",
    });
    expect(result.report.projectTaskNumber).toBe(1);
    expect(result.queried).toEqual(result.report);
    expect(result.drawerTask?.type).toBe("bug");
  } finally {
    await authPool.query('DELETE FROM activity WHERE "projectId" = $1', [
      projectId,
    ]);
    await authPool.query('DELETE FROM "bug_report" WHERE "projectId" = $1', [
      projectId,
    ]);
    await authPool.query('DELETE FROM task WHERE "projectId" = $1', [
      projectId,
    ]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [actorId]);
  }
});
