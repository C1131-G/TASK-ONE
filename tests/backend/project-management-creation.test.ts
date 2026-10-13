import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import { runEffectResult } from "../../src/server/core/action-result";
import { ProjectManagement } from "../../src/server/projects/project-contracts";
import { ProjectManagementLive } from "../../src/server/projects/project-management";

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
        color: "violet",
        description: "Studio launch board",
        dueDate: "2026-12-31",
        icon: "rocket",
        key: projectKey,
        name: "Studio launch",
        startDate: "2026-10-01",
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
    expect(project.color).toBe("violet");
    expect(project.icon).toBe("rocket");
    expect(project.startDate).toBe("2026-10-01");
    expect(project.dueDate).toBe("2026-12-31");

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
        color: "emerald",
        description: "Updated studio launch board",
        dueDate: null,
        icon: "sparkles",
        name: "Studio launch v2",
        position: 4,
        startDate: "2026-10-15",
        status: "risk",
        teamId: null,
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
    expect(updated.color).toBe("emerald");
    expect(updated.icon).toBe("sparkles");
    expect(updated.position).toBe(4);
    expect(updated.startDate).toBe("2026-10-15");
    expect(updated.dueDate).toBeNull();
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
    const archivedProjectList = Effect.gen(function* listArchivedProjects() {
      const projects = yield* ProjectManagement;
      return yield* projects.listProjects(employeeId, {
        includeArchived: true,
      });
    });
    const archivedProjects = await Effect.runPromise(
      Effect.provide(archivedProjectList, ProjectManagementLive)
    );
    expect(archivedProjects).toContainEqual(
      expect.objectContaining({
        archivedAt: expect.any(String),
        id: project.id,
      })
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
