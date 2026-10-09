import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import { runEffectResult } from "../../src/server/core/action-result";
import {
  ProjectManagement,
  ProjectManagementLive,
} from "../../src/server/projects/project-management";
import {
  WorkManagement,
  WorkManagementLive,
} from "../../src/server/work/work-management";

it("creates a project for an admin and rejects employee project creation", async () => {
  const adminId = randomUUID();
  const employeeId = randomUUID();
  const projectKey = `PR${randomUUID().slice(0, 6)}`.toUpperCase();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'admin\', false), ($4, $5, $6, $6, \'employee\', false)',
    [
      adminId,
      "Project Admin",
      `${adminId}@project-test.example`,
      employeeId,
      "Project Employee",
      `${employeeId}@project-test.example`,
    ]
  );

  try {
    const employeeAttempt = Effect.gen(function* employeeCreate() {
      const projects = yield* ProjectManagement;
      return yield* projects.createProject(employeeId, {
        description: null,
        key: projectKey,
        name: "Employee project",
        status: "planning",
      });
    });
    const denied = await runEffectResult(
      Effect.provide(employeeAttempt, ProjectManagementLive)
    );
    expect(denied).toMatchObject({
      error: { code: "FORBIDDEN" },
      ok: false,
    });

    const create = Effect.gen(function* createProject() {
      const projects = yield* ProjectManagement;
      return yield* projects.createProject(adminId, {
        description: "Studio launch board",
        key: projectKey,
        name: "Studio launch",
        status: "active",
      });
    });
    const project = await Effect.runPromise(
      Effect.provide(create, ProjectManagementLive)
    );

    expect(project.key).toBe(projectKey);
    expect(project.name).toBe("Studio launch");
    expect(project.status).toBe("active");
    expect(project.version).toBe(1);

    const people = Effect.gen(function* setPeople() {
      const projects = yield* ProjectManagement;
      return yield* projects.setProjectPeople(adminId, project.id, 1, {
        leadId: employeeId,
        memberIds: [employeeId],
      });
    });
    const projectWithPeople = await Effect.runPromise(
      Effect.provide(people, ProjectManagementLive)
    );
    const visibleProjects = Effect.gen(function* listVisibleProjects() {
      const projects = yield* ProjectManagement;
      return yield* projects.listProjects(employeeId);
    });
    const employeeProjects = await Effect.runPromise(
      Effect.provide(visibleProjects, ProjectManagementLive)
    );
    expect(projectWithPeople.leadId).toBe(employeeId);
    expect(projectWithPeople.memberIds).toEqual([employeeId]);
    expect(employeeProjects.some((item) => item.id === project.id)).toBe(true);

    const update = Effect.gen(function* updateProject() {
      const projects = yield* ProjectManagement;
      return yield* projects.updateProject(adminId, project.id, 2, {
        description: "Updated studio launch board",
        name: "Studio launch v2",
        status: "risk",
      });
    });
    const updated = await Effect.runPromise(
      Effect.provide(update, ProjectManagementLive)
    );
    const staleUpdate = Effect.gen(function* staleProjectUpdate() {
      const projects = yield* ProjectManagement;
      return yield* projects.updateProject(adminId, project.id, 2, {
        description: null,
        name: "Stale overwrite",
        status: "hold",
      });
    });
    const stale = await runEffectResult(
      Effect.provide(staleUpdate, ProjectManagementLive)
    );

    expect(updated.name).toBe("Studio launch v2");
    expect(updated.version).toBe(3);
    expect(stale).toMatchObject({
      error: { code: "CONFLICT" },
      ok: false,
    });

    const archive = Effect.gen(function* archiveProject() {
      const projects = yield* ProjectManagement;
      return yield* projects.archiveProject(adminId, project.id, 3);
    });
    const archived = await Effect.runPromise(
      Effect.provide(archive, ProjectManagementLive)
    );
    const restore = Effect.gen(function* restoreProject() {
      const projects = yield* ProjectManagement;
      return yield* projects.restoreProject(adminId, project.id, 4);
    });
    const restored = await Effect.runPromise(
      Effect.provide(restore, ProjectManagementLive)
    );
    expect(archived.archivedAt).toBeTruthy();
    expect(archived.version).toBe(4);
    expect(restored.archivedAt).toBeNull();
    expect(restored.version).toBe(5);

    const createMilestone = Effect.gen(function* createMilestone() {
      const projects = yield* ProjectManagement;
      return yield* projects.saveProjectMilestones(adminId, project.id, 5, [
        {
          completed: false,
          dueDate: "2026-11-01",
          id: null,
          name: "Design review",
        },
      ]);
    });
    const createdMilestones = await Effect.runPromise(
      Effect.provide(createMilestone, ProjectManagementLive)
    );
    expect(createdMilestones.version).toBe(6);
    expect(createdMilestones.milestones).toHaveLength(1);
    const milestoneId = createdMilestones.milestones[0]?.id;
    expect(milestoneId).toBeTruthy();

    const updateMilestone = Effect.gen(function* updateMilestone() {
      const projects = yield* ProjectManagement;
      return yield* projects.saveProjectMilestones(adminId, project.id, 6, [
        {
          completed: true,
          dueDate: "2026-11-15",
          id: milestoneId ?? null,
          name: "Final design review",
        },
      ]);
    });
    const updatedMilestones = await Effect.runPromise(
      Effect.provide(updateMilestone, ProjectManagementLive)
    );
    expect(updatedMilestones.milestones[0]?.name).toBe("Final design review");
    expect(updatedMilestones.milestones[0]?.completed).toBe(true);

    const removeMilestone = Effect.gen(function* removeMilestone() {
      const projects = yield* ProjectManagement;
      return yield* projects.saveProjectMilestones(adminId, project.id, 7, []);
    });
    const removedMilestones = await Effect.runPromise(
      Effect.provide(removeMilestone, ProjectManagementLive)
    );
    expect(removedMilestones.milestones).toEqual([]);
  } finally {
    await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [
      adminId,
    ]);
    await authPool.query("DELETE FROM project WHERE key = $1", [projectKey]);
    await authPool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [
      [adminId, employeeId],
    ]);
  }
});

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
