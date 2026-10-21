import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import {
  Collaboration,
  CollaborationLive,
} from "../../src/server/collaboration/service";
import { ProjectManagement } from "../../src/server/projects/project-contracts";
import { ProjectManagementLive } from "../../src/server/projects/project-management";
import {
  WebhookManagement,
  WebhookManagementLive,
} from "../../src/server/webhooks/webhook-management";
import {
  BugManagement,
  BugManagementLive,
} from "../../src/server/work/bug-management";
import {
  BugWorkflowManagement,
  BugWorkflowManagementLive,
} from "../../src/server/work/bug-workflow-management";
import {
  WorkManagement,
  WorkManagementLive,
} from "../../src/server/work/work-management";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

const domain = "webhook-wiring.example";
const adminId = randomUUID();
const projectId = randomUUID();
const createdProjectIds: string[] = [];
let endpointId = "";

const ALL_EVENTS = [
  "task.created",
  "task.updated",
  "task.completed",
  "comment.added",
  "bug.status_changed",
  "project.created",
] as const;

const run = <Value, Failure>(
  program: Effect.Effect<
    Value,
    Failure,
    | WorkManagement
    | Collaboration
    | ProjectManagement
    | BugManagement
    | BugWorkflowManagement
  >
) =>
  Effect.runPromise(
    program.pipe(
      Effect.provide(WorkManagementLive),
      Effect.provide(CollaborationLive),
      Effect.provide(ProjectManagementLive),
      Effect.provide(BugManagementLive),
      Effect.provide(BugWorkflowManagementLive)
    )
  );

const deliveries = async (type: string) => {
  const rows = await authPool.query<{ payload: Record<string, unknown> }>(
    'SELECT payload FROM webhook_delivery WHERE "endpointId" = $1 AND "eventType" = $2 ORDER BY "createdAt"',
    [endpointId, type]
  );
  return rows.rows.map(({ payload }) => payload);
};

beforeAll(async () => {
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [adminId, "Wiring Admin", `${adminId}@${domain}`, "admin"]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `W${projectId.slice(0, 7)}`, "Webhook wiring"]
  );
  const created = await Effect.runPromise(
    Effect.provide(
      Effect.gen(function* create() {
        const service = yield* WebhookManagement;
        return yield* service.create(adminId, {
          events: [...ALL_EVENTS],
          kind: "generic",
          name: "Wiring",
          url: "https://receiver.example.com/in",
        });
      }),
      WebhookManagementLive
    )
  );
  endpointId = created.endpoint.id;
});

afterAll(async () => {
  const projects = [projectId, ...createdProjectIds];
  await authPool.query("DELETE FROM webhook_endpoint WHERE id = $1", [
    endpointId,
  ]);
  await authPool.query("DELETE FROM job WHERE kind = 'webhooks.deliver'");
  await authPool.query(
    'DELETE FROM job WHERE "dedupeKey" IN (SELECT \'push:\' || id::text FROM notification WHERE "taskId" IN (SELECT id FROM task WHERE "projectId" = ANY($1::uuid[])))',
    [projects]
  );
  await authPool.query(
    'DELETE FROM notification WHERE "taskId" IN (SELECT id FROM task WHERE "projectId" = ANY($1::uuid[]))',
    [projects]
  );
  const wiringUsers = `(SELECT id FROM "user" WHERE email LIKE '%@${domain}')`;
  await authPool.query(
    `DELETE FROM activity WHERE "actorId" IN ${wiringUsers}`
  );
  await authPool.query(
    `DELETE FROM undo_record WHERE "actorId" IN ${wiringUsers}`
  );
  await authPool.query(
    'DELETE FROM comment WHERE "taskId" IN (SELECT id FROM task WHERE "projectId" = ANY($1::uuid[]))',
    [projects]
  );
  await authPool.query(
    'DELETE FROM bug_sla WHERE "bugId" IN (SELECT id FROM bug_report WHERE "projectId" = ANY($1::uuid[]))',
    [projects]
  );
  await authPool.query(
    'DELETE FROM bug_report WHERE "projectId" = ANY($1::uuid[])',
    [projects]
  );
  await authPool.query(
    'DELETE FROM task_assignee WHERE "taskId" IN (SELECT id FROM task WHERE "projectId" = ANY($1::uuid[]))',
    [projects]
  );
  await authPool.query('DELETE FROM task WHERE "projectId" = ANY($1::uuid[])', [
    projects,
  ]);
  await authPool.query(
    'DELETE FROM project_task_counter WHERE "projectId" = ANY($1::uuid[])',
    [projects]
  );
  await authPool.query("DELETE FROM project WHERE id = ANY($1::uuid[])", [
    projects,
  ]);
  await authPool.query('DELETE FROM "user" WHERE email LIKE $1', [
    `%@${domain}`,
  ]);
});

it("emits task.created, then task.updated, then task.completed with public fields only", async () => {
  const created = await run(
    Effect.gen(function* create() {
      const work = yield* WorkManagement;
      return yield* work.createTask(adminId, {
        assigneeIds: [],
        description: "<p>private planning notes</p>",
        dueDate: null,
        priority: "high",
        projectId,
        title: "Wire the hooks",
      });
    })
  );
  const [createdEvent] = await deliveries("task.created");
  expect(createdEvent).toMatchObject({
    data: {
      id: created.id,
      priority: "high",
      projectId,
      status: "todo",
      title: "Wire the hooks",
    },
    type: "task.created",
  });
  expect(JSON.stringify(createdEvent)).not.toContain("private planning");

  const edited = await run(
    Effect.gen(function* update() {
      const work = yield* WorkManagement;
      return yield* work.updateTask(adminId, created.id, created.version, {
        assigneeIds: [],
        description: "<p>private planning notes</p>",
        dueDate: null,
        priority: "low",
        status: "progress",
        title: "Wire the hooks",
      });
    })
  );
  expect(await deliveries("task.updated")).toHaveLength(1);
  expect(await deliveries("task.completed")).toHaveLength(0);

  await run(
    Effect.gen(function* complete() {
      const work = yield* WorkManagement;
      return yield* work.updateTask(adminId, created.id, edited.version, {
        assigneeIds: [],
        description: "<p>private planning notes</p>",
        dueDate: null,
        priority: "low",
        status: "done",
        title: "Wire the hooks",
      });
    })
  );
  const [completed] = await deliveries("task.completed");
  expect(completed).toMatchObject({
    data: { id: created.id, status: "done" },
    type: "task.completed",
  });
  expect(await deliveries("task.updated")).toHaveLength(1);
});

it("emits comment.added with ids and visibility, never the text", async () => {
  const task = await run(
    Effect.gen(function* create() {
      const work = yield* WorkManagement;
      return yield* work.createTask(adminId, {
        assigneeIds: [],
        description: null,
        dueDate: null,
        priority: "low",
        projectId,
        title: "Comment target",
      });
    })
  );
  await run(
    Effect.gen(function* comment() {
      const collaboration = yield* Collaboration;
      yield* collaboration.createComment(
        adminId,
        task.id,
        "internal only text",
        "internal"
      );
    })
  );
  const allComments = await deliveries("comment.added");
  const events = allComments.filter(
    (event) =>
      typeof event["data"] === "object" &&
      event["data"] !== null &&
      "taskId" in event["data"] &&
      event["data"].taskId === task.id
  );
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    data: { projectId, taskId: task.id, visibility: "internal" },
  });
  expect(JSON.stringify(events[0])).not.toContain("internal only text");
});

it("emits project.created with the id and name", async () => {
  const key = `P${randomUUID().slice(0, 6).toUpperCase()}`;
  const project = await run(
    Effect.gen(function* create() {
      const projects = yield* ProjectManagement;
      return yield* projects.createProject(adminId, {
        description: "internal scope",
        key,
        name: "Wired project",
        status: "planning",
      });
    })
  );
  createdProjectIds.push(project.id);
  const events = await deliveries("project.created");
  const found = events.find(
    (event) =>
      typeof event["data"] === "object" &&
      event["data"] !== null &&
      "id" in event["data"] &&
      event["data"].id === project.id
  );
  expect(found).toMatchObject({
    data: { id: project.id, name: "Wired project" },
  });
  expect(JSON.stringify(found)).not.toContain("internal scope");
});

it("emits bug.status_changed with ids and both statuses", async () => {
  const report = await run(
    Effect.gen(function* reportAndTriage() {
      const bugs = yield* BugManagement;
      const workflow = yield* BugWorkflowManagement;
      const reported = yield* bugs.reportBug(adminId, {
        actualBehavior: "Blank panel with customer@example.com data.",
        appVersion: "1.0.0",
        browser: "Firefox",
        component: "Panel",
        description: null,
        device: "Desktop",
        discoverySource: "employee_report",
        environment: "staging",
        expectedBehavior: "Totals show.",
        os: "Windows",
        projectId,
        reproductionSteps: ["Open it"],
        route: "/overview",
        severity: "minor",
        title: "Panel blank",
      });
      yield* workflow.triage(adminId, {
        assigneeIds: [],
        bugId: reported.id,
        expectedVersion: reported.version,
        priority: "high",
        severity: "critical",
      });
      return reported;
    })
  );
  const events = await deliveries("bug.status_changed");
  const found = events.find(
    (event) =>
      typeof event["data"] === "object" &&
      event["data"] !== null &&
      "bugId" in event["data"] &&
      event["data"].bugId === report.id
  );
  expect(found).toMatchObject({
    data: { bugId: report.id, from: "reported", projectId, to: "triaged" },
  });
  expect(JSON.stringify(found)).not.toContain("customer@example.com");
});
