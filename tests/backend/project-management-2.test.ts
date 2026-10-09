import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import { runEffectResult } from "../../src/server/core/action-result";
import { ProjectManagement } from "../../src/server/projects/project-contracts";
import { ProjectManagementLive } from "../../src/server/projects/project-management";
import {
  WorkManagement,
  WorkManagementLive,
} from "../../src/server/work/work-management";

it("creates starter tasks only when an explicit project template is selected", async () => {
  const adminId = randomUUID();
  const projectKey = `TM${randomUUID().slice(0, 6)}`.toUpperCase();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'admin\', false)',
    [adminId, "Template Admin", `${adminId}@template-test.example`]
  );
  let projectId = "";
  try {
    const create = Effect.gen(function* createTemplateProject() {
      const projects = yield* ProjectManagement;
      return yield* projects.createProject(adminId, {
        description: null,
        key: projectKey,
        name: "Website project",
        status: "planning",
        templateId: "web",
      });
    });
    const project = await Effect.runPromise(
      Effect.provide(create, ProjectManagementLive)
    );
    projectId = project.id;
    const list = Effect.gen(function* listProjects() {
      const projects = yield* ProjectManagement;
      return yield* projects.listProjects(adminId);
    });
    const projects = await Effect.runPromise(
      Effect.provide(list, ProjectManagementLive)
    );

    expect(projects.find(({ id }) => id === project.id)?.taskCount).toBe(6);
  } finally {
    await authPool.query('DELETE FROM notification WHERE "userId" = $1', [
      adminId,
    ]);
    if (projectId) {
      await authPool.query('DELETE FROM activity WHERE "projectId" = $1', [
        projectId,
      ]);
      await authPool.query('DELETE FROM task WHERE "projectId" = $1', [
        projectId,
      ]);
      await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    }
    await authPool.query('DELETE FROM "user" WHERE id = $1', [adminId]);
  }
});

it("duplicates project members, milestones, and active task structure", async () => {
  const adminId = randomUUID();
  const employeeId = randomUUID();
  const suffix = randomUUID().slice(0, 6).toUpperCase();
  const sourceKey = `S${suffix}`;
  const duplicateKey = `D${suffix}`;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'admin\', false), ($4, $5, $6, $6, \'employee\', false)',
    [
      adminId,
      "Project Copy Admin",
      `${adminId}@project-copy.example`,
      employeeId,
      "Project Copy Member",
      `${employeeId}@project-copy.example`,
    ]
  );

  try {
    const source = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* createSourceProject() {
          const projects = yield* ProjectManagement;
          return yield* projects.createProject(adminId, {
            description: "Copy these project details",
            key: sourceKey,
            name: "Source project",
            status: "active",
          });
        }),
        ProjectManagementLive
      )
    );
    const sourcePeople = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* addMember() {
          const projects = yield* ProjectManagement;
          return yield* projects.setProjectPeople(adminId, source.id, 1, {
            leadId: employeeId,
            memberIds: [employeeId],
          });
        }),
        ProjectManagementLive
      )
    );
    const sourceMilestones = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* addMilestone() {
          const projects = yield* ProjectManagement;
          return yield* projects.saveProjectMilestones(adminId, source.id, 2, [
            {
              completed: true,
              dueDate: "2026-11-10",
              id: null,
              name: "Source milestone",
            },
          ]);
        }),
        ProjectManagementLive
      )
    );
    const sourceTask = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* createCompletedSourceTask() {
          const work = yield* WorkManagement;
          const created = yield* work.createTask(adminId, {
            assigneeIds: [employeeId],
            description: "Copy task structure",
            dueDate: "2026-11-20",
            priority: "high",
            projectId: source.id,
            title: "Prepare deliverables",
          });
          return yield* work.updateTask(adminId, created.id, created.version, {
            assigneeIds: [employeeId],
            description: created.description,
            dueDate: created.dueDate,
            priority: created.priority,
            status: "done",
            title: created.title,
          });
        }),
        WorkManagementLive
      )
    );
    const denied = await runEffectResult(
      Effect.provide(
        Effect.gen(function* employeeDuplicate() {
          const projects = yield* ProjectManagement;
          return yield* projects.duplicateProject(employeeId, source.id, {
            key: duplicateKey,
            name: "Unauthorized copy",
          });
        }),
        ProjectManagementLive
      )
    );
    const duplicate = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* duplicateProject() {
          const projects = yield* ProjectManagement;
          return yield* projects.duplicateProject(adminId, source.id, {
            key: duplicateKey,
            name: "Duplicated project",
          });
        }),
        ProjectManagementLive
      )
    );
    const list = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* listProjects() {
          const projects = yield* ProjectManagement;
          return yield* projects.listProjects(employeeId);
        }),
        ProjectManagementLive
      )
    );
    const duplicateSummary = list.find(({ id }) => id === duplicate.id);

    expect(sourcePeople.memberIds).toEqual([employeeId]);
    expect(sourceMilestones.milestones).toHaveLength(1);
    expect(sourceTask.status).toBe("done");
    expect(denied).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
    expect(duplicateSummary).toMatchObject({
      completedTaskCount: 0,
      key: duplicateKey,
      memberIds: [employeeId],
      name: "Duplicated project",
      progress: 0,
      taskCount: 1,
    });
  } finally {
    await authPool.query(
      "DELETE FROM job WHERE payload->>'actorId' = ANY($1::text[])",
      [[adminId, employeeId]]
    );
    await authPool.query(
      'DELETE FROM notification WHERE "userId" = ANY($1::text[])',
      [[adminId, employeeId]]
    );
    await authPool.query(
      'DELETE FROM activity WHERE "actorId" = ANY($1::text[])',
      [[adminId, employeeId]]
    );
    await authPool.query('DELETE FROM undo_record WHERE "actorId" = $1', [
      adminId,
    ]);
    await authPool.query(
      'DELETE FROM task WHERE "projectId" IN (SELECT id FROM project WHERE key = ANY($1::text[]))',
      [[sourceKey, duplicateKey]]
    );
    await authPool.query("DELETE FROM project WHERE key = ANY($1::text[])", [
      [sourceKey, duplicateKey],
    ]);
    await authPool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [
      [adminId, employeeId],
    ]);
  }
});
