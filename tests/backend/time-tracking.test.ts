import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import {
  TimeTracking,
  TimeTrackingLive,
} from "../../src/server/time/time-tracking";
import {
  WorkManagement,
  WorkManagementLive,
} from "../../src/server/work/work-management";

const time = <Value, Failure>(
  program: (service: TimeTracking["Service"]) => Effect.Effect<Value, Failure>
) =>
  Effect.runPromise(
    Effect.provide(
      Effect.gen(function* run() {
        return yield* program(yield* TimeTracking);
      }),
      TimeTrackingLive
    )
  );

const failureCode = (
  program: (
    service: TimeTracking["Service"]
  ) => Effect.Effect<unknown, { readonly code: string }>
) =>
  Effect.runPromise(
    Effect.provide(
      Effect.gen(function* run() {
        const error = yield* Effect.flip(program(yield* TimeTracking));
        return error.code;
      }),
      TimeTrackingLive
    )
  );

const suffix = randomUUID().slice(0, 8);
const aliceId = randomUUID();
const bobId = randomUUID();
const adminId = randomUUID();
const clientId = randomUUID();
const companyId = randomUUID();
const projectId = randomUUID();
const otherProjectId = randomUUID();
let taskA = "";
let taskB = "";
let otherTask = "";

const insertUser = async (id: string, name: string, role = "employee") => {
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [id, name, `${id}@time-tracking.example`, role]
  );
};

const createTask = (title: string, project = projectId) =>
  Effect.runPromise(
    Effect.provide(
      Effect.gen(function* create() {
        const work = yield* WorkManagement;
        return yield* work.createTask(aliceId, {
          assigneeIds: [],
          description: null,
          dueDate: null,
          priority: "medium",
          projectId: project,
          title,
        });
      }),
      WorkManagementLive
    )
  );

beforeAll(async () => {
  await insertUser(aliceId, "Alice Timer");
  await insertUser(bobId, "Bob Timer");
  await insertUser(adminId, "Ada Admin", "admin");
  await authPool.query(
    'INSERT INTO client_company (id, name, "createdById") VALUES ($1, $2, $3)',
    [companyId, `Time client ${companyId}`, adminId]
  );
  await authPool.query(
    `INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword", "clientCompanyId") VALUES ($1, 'Cleo Client', $2, $2, 'client', false, $3)`,
    [clientId, `${clientId}@time-tracking.example`, companyId]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, 'Time project'), ($3, $4, 'Other time project')",
    [
      projectId,
      `T${suffix.slice(0, 5)}`,
      otherProjectId,
      `U${suffix.slice(0, 5)}`,
    ]
  );
  const first = await createTask("Write the brief");
  const second = await createTask('Review, the "draft"');
  const third = await createTask("Elsewhere", otherProjectId);
  taskA = first.id;
  taskB = second.id;
  otherTask = third.id;
});

afterAll(async () => {
  const users = [aliceId, bobId, adminId, clientId];
  await authPool.query(
    'DELETE FROM time_entry WHERE "userId" = ANY($1::text[])',
    [users]
  );
  await authPool.query(
    'DELETE FROM time_timer WHERE "userId" = ANY($1::text[])',
    [users]
  );
  await authPool.query(
    'DELETE FROM undo_record WHERE "actorId" = ANY($1::text[])',
    [users]
  );
  await authPool.query(
    'DELETE FROM activity WHERE "actorId" = ANY($1::text[])',
    [users]
  );
  await authPool.query('DELETE FROM task WHERE "projectId" = ANY($1::uuid[])', [
    [projectId, otherProjectId],
  ]);
  await authPool.query("DELETE FROM project WHERE id = ANY($1::uuid[])", [
    [projectId, otherProjectId],
  ]);
  await authPool.query('DELETE FROM "user" WHERE id = $1', [clientId]);
  await authPool.query("DELETE FROM client_company WHERE id = $1", [companyId]);
  await authPool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [
    users,
  ]);
});

it("keeps one running timer per person and stops the old one when another starts", async () => {
  const t0 = new Date("2026-10-19T09:00:00.000Z");
  const first = await time((service) =>
    service.startTimer(
      aliceId,
      { billable: true, note: null, taskId: taskA },
      t0
    )
  );
  expect(first.stopped).toBeNull();
  expect(first.timer.taskId).toBe(taskA);
  expect(first.timer.billable).toBe(true);

  // Starting the same task again changes nothing.
  const again = await time((service) =>
    service.startTimer(
      aliceId,
      { billable: true, note: null, taskId: taskA },
      new Date("2026-10-19T09:10:00.000Z")
    )
  );
  expect(again.stopped).toBeNull();
  expect(again.timer.startedAt).toBe(first.timer.startedAt);

  const second = await time((service) =>
    service.startTimer(
      aliceId,
      { billable: false, note: "second", taskId: taskB },
      new Date("2026-10-19T10:30:00.000Z")
    )
  );
  expect(second.stopped).toMatchObject({
    billable: true,
    minutes: 90,
    taskId: taskA,
    workDate: "2026-10-19",
  });
  expect(second.timer.taskId).toBe(taskB);
  const running = await authPool.query(
    'SELECT "taskId" FROM time_timer WHERE "userId" = $1',
    [aliceId]
  );
  expect(running.rows).toEqual([{ taskId: taskB }]);

  const stopped = await time((service) =>
    service.stopTimer(aliceId, new Date("2026-10-19T10:30:10.000Z"))
  );
  // A few seconds still count as one minute.
  expect(stopped.minutes).toBe(1);
  expect(stopped.note).toBe("second");
  expect(await time((service) => service.runningTimer(aliceId))).toBeNull();
  expect(
    await failureCode((service) => service.stopTimer(aliceId, new Date()))
  ).toBe("NOT_FOUND");
});

it("totals manual entries per task and keeps billable minutes apart", async () => {
  await time((service) =>
    service.addEntry(bobId, {
      billable: true,
      minutes: 45,
      note: "Kick-off",
      taskId: taskA,
      workDate: "2026-10-20",
    })
  );
  await time((service) =>
    service.addEntry(bobId, {
      billable: false,
      minutes: 15,
      note: null,
      taskId: taskA,
      workDate: "2026-10-21",
    })
  );
  const summary = await time((service) => service.taskTime(bobId, taskA));
  // Alice's 90 minutes from the timer test belong to the same task.
  expect(summary.totalMinutes).toBe(150);
  expect(summary.billableMinutes).toBe(135);
  expect(summary.entries.map((entry) => entry.userName)).toContain("Bob Timer");
});

it("validates minutes, dates, notes and the task", async () => {
  const base = {
    billable: false,
    minutes: 30,
    note: null,
    taskId: taskA,
    workDate: "2026-10-20",
  };
  for (const bad of [
    { ...base, minutes: 0 },
    { ...base, minutes: 1441 },
    { ...base, minutes: 1.5 },
    { ...base, workDate: "2026-02-30" },
    { ...base, note: "x".repeat(501) },
  ]) {
    // eslint-disable-next-line no-await-in-loop
    expect(await failureCode((service) => service.addEntry(bobId, bad))).toBe(
      "VALIDATION_FAILED"
    );
  }
  expect(
    await failureCode((service) =>
      service.addEntry(bobId, { ...base, taskId: randomUUID() })
    )
  ).toBe("NOT_FOUND");
});

it("lets people change their own entries and administrators any, but nobody else's", async () => {
  const entry = await time((service) =>
    service.addEntry(bobId, {
      billable: false,
      minutes: 20,
      note: "draft",
      taskId: taskB,
      workDate: "2026-10-20",
    })
  );
  expect(
    await failureCode((service) =>
      service.updateEntry(aliceId, entry.id, {
        billable: true,
        minutes: 25,
        note: null,
        workDate: "2026-10-20",
      })
    )
  ).toBe("FORBIDDEN");
  expect(
    await failureCode((service) => service.deleteEntry(aliceId, entry.id))
  ).toBe("FORBIDDEN");
  const own = await time((service) =>
    service.updateEntry(bobId, entry.id, {
      billable: true,
      minutes: 25,
      note: "final",
      workDate: "2026-10-21",
    })
  );
  expect(own).toMatchObject({
    billable: true,
    minutes: 25,
    note: "final",
    workDate: "2026-10-21",
  });
  const byAdmin = await time((service) =>
    service.updateEntry(adminId, entry.id, {
      billable: false,
      minutes: 30,
      note: "final",
      workDate: "2026-10-21",
    })
  );
  expect(byAdmin.minutes).toBe(30);
  await time((service) => service.deleteEntry(adminId, entry.id));
  expect(
    await failureCode((service) => service.deleteEntry(bobId, entry.id))
  ).toBe("NOT_FOUND");
});

it("shows a person's own week, Monday to Sunday, with day totals", async () => {
  const week = await time((service) => service.weeklyTime(bobId, "2026-10-19"));
  expect(week.weekStart).toBe("2026-10-19");
  expect(week.days.map((day) => day.date)).toEqual([
    "2026-10-19",
    "2026-10-20",
    "2026-10-21",
    "2026-10-22",
    "2026-10-23",
    "2026-10-24",
    "2026-10-25",
  ]);
  expect(week.days.map((day) => day.minutes)).toEqual([0, 45, 15, 0, 0, 0, 0]);
  expect(week.totalMinutes).toBe(60);
  expect(week.billableMinutes).toBe(45);
  expect(week.entries.every((entry) => entry.userId === bobId)).toBe(true);
  // A date mid-week is snapped to its Monday.
  const snapped = await time((service) =>
    service.weeklyTime(bobId, "2026-10-22")
  );
  expect(snapped.weekStart).toBe("2026-10-19");
});

it("reports a project's time by person and task and exports it as CSV", async () => {
  const report = await time((service) =>
    service.projectReport(adminId, projectId, {
      from: "2026-10-19",
      to: "2026-10-25",
    })
  );
  expect(report.totalMinutes).toBe(151);
  expect(report.billableMinutes).toBe(135);
  expect(report.nonBillableMinutes).toBe(16);
  expect(
    report.byPerson.map(({ billableMinutes, name, totalMinutes }) => ({
      billableMinutes,
      name,
      totalMinutes,
    }))
  ).toEqual([
    { billableMinutes: 90, name: "Alice Timer", totalMinutes: 91 },
    { billableMinutes: 45, name: "Bob Timer", totalMinutes: 60 },
  ]);
  expect(report.byTask.map((row) => row.totalMinutes)).toEqual([150, 1]);

  // Another project's time never leaks in.
  await time((service) =>
    service.addEntry(aliceId, {
      billable: true,
      minutes: 500,
      note: null,
      taskId: otherTask,
      workDate: "2026-10-20",
    })
  );
  const still = await time((service) =>
    service.projectReport(adminId, projectId, {
      from: "2026-10-19",
      to: "2026-10-25",
    })
  );
  expect(still.totalMinutes).toBe(151);

  await time((service) =>
    service.addEntry(bobId, {
      billable: false,
      minutes: 10,
      note: '=HYPERLINK("x")',
      taskId: taskB,
      workDate: "2026-10-22",
    })
  );
  const csv = await time((service) =>
    service.projectReportCsv(adminId, projectId, {
      from: "2026-10-19",
      to: "2026-10-25",
    })
  );
  const lines = csv.split("\r\n");
  expect(lines[0]).toBe("date,person,task,minutes,billable,note");
  expect(csv).toContain("2026-10-22,Bob Timer");
  // The shared escaping neutralises formulas and quotes awkward titles.
  expect(csv).toContain("'=HYPERLINK");
  expect(csv).toContain('"Review, the ""draft"""');
});

it("limits the project report to administrators and project members", async () => {
  expect(
    await failureCode((service) =>
      service.projectReport(bobId, projectId, {
        from: "2026-10-19",
        to: "2026-10-25",
      })
    )
  ).toBe("FORBIDDEN");
  await authPool.query(
    'INSERT INTO project_member ("projectId", "userId") VALUES ($1, $2)',
    [projectId, bobId]
  );
  try {
    const report = await time((service) =>
      service.projectReport(bobId, projectId, {
        from: "2026-10-19",
        to: "2026-10-25",
      })
    );
    expect(report.totalMinutes).toBeGreaterThan(0);
  } finally {
    await authPool.query('DELETE FROM project_member WHERE "projectId" = $1', [
      projectId,
    ]);
  }
});

it("never lets clients track or read time", async () => {
  expect(
    await failureCode((service) =>
      service.addEntry(clientId, {
        billable: false,
        minutes: 5,
        note: null,
        taskId: taskA,
        workDate: "2026-10-20",
      })
    )
  ).toBe("UNAUTHENTICATED");
  expect(
    await failureCode((service) => service.taskTime(clientId, taskA))
  ).toBe("UNAUTHENTICATED");
  expect(
    await failureCode((service) =>
      service.startTimer(
        clientId,
        { billable: false, note: null, taskId: taskA },
        new Date()
      )
    )
  ).toBe("UNAUTHENTICATED");
});

it("offers the open tasks a person is assigned to for logging time", async () => {
  await authPool.query(
    'INSERT INTO task_assignee ("taskId", "userId", "assignedById") VALUES ($1, $2, $3), ($4, $2, $3)',
    [taskA, bobId, adminId, otherTask]
  );
  try {
    const options = await time((service) => service.assignedTasks(bobId));
    expect(options.map((option) => option.taskId).toSorted()).toEqual(
      [taskA, otherTask].toSorted()
    );
    expect(options.find((option) => option.taskId === taskA)).toMatchObject({
      reference: expect.stringMatching(/^T[0-9a-f]{5}-\d+$/u),
      title: "Write the brief",
    });
    expect(await time((service) => service.assignedTasks(aliceId))).toEqual([]);
  } finally {
    await authPool.query('DELETE FROM task_assignee WHERE "userId" = $1', [
      bobId,
    ]);
  }
});
