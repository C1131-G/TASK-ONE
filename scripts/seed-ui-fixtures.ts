import "dotenv/config";
import { Effect, Layer } from "effect";

import { db } from "../src/prisma/db";
import { authPool } from "../src/server/auth/database";
import { Collaboration } from "../src/server/collaboration/contracts";
import { CollaborationLive } from "../src/server/collaboration/service";
import { ProjectManagement } from "../src/server/projects/project-contracts";
import { ProjectManagementLive } from "../src/server/projects/project-management";
import { StorageLive } from "../src/server/storage/storage";
import { UploadsLive } from "../src/server/storage/uploads";
import { Uploads } from "../src/server/storage/uploads-contracts";
import {
  BugManagement,
  BugManagementLive,
} from "../src/server/work/bug-management";
import {
  WorkManagement,
  WorkManagementLive,
} from "../src/server/work/work-management";

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be configured before seeding UI fixtures."
  );
}

const database = new URL(databaseUrl);
const databaseName = decodeURIComponent(database.pathname.slice(1));
if (
  process.env["NODE_ENV"] === "production" ||
  !["localhost", "127.0.0.1", "::1"].includes(database.hostname) ||
  !databaseName.startsWith("metsys") ||
  databaseName.endsWith("_test")
) {
  throw new Error(
    "UI fixtures can only be seeded into a local, non-test Metsys database."
  );
}

const EMPTY_KEY = "UIE";
const ARCHIVED_KEY = "UIA";
const POPULATED_KEY = "UIP";
const TASK_COUNT = 60;
const PRIORITIES = ["urgent", "high", "medium", "low", "none"] as const;

const findUser = async (email: string) => {
  const user = await db.orm.public.User.where({ emailNormalized: email })
    .select("id")
    .first();
  if (!user) {
    throw new Error(
      `Seed user ${email} is missing; create it before seeding fixtures.`
    );
  }
  return user.id;
};

const findSeedAdministrator = async () => {
  const user = await db.orm.public.User.where({
    deactivatedAt: null,
    mustChangePassword: false,
    role: "admin",
  })
    .select("id")
    .first();
  if (!user) {
    throw new Error(
      "An active admin with a completed password setup is required to seed UI fixtures."
    );
  }
  return user.id;
};

const isoDate = (offsetDays: number) => {
  const date = new Date(Date.UTC(2026, 9, 12 + offsetDays));
  return date.toISOString().slice(0, 10);
};

const findProjectId = (key: string) =>
  Effect.promise(async () => {
    const project = await db.orm.public.Project.where({ key })
      .select("id")
      .first();
    return project?.id ?? null;
  });

const seedBase = (actorId: string, adminId: string, employeeId: string) =>
  Effect.gen(function* seedBaseFixtures() {
    const projects = yield* ProjectManagement;
    const work = yield* WorkManagement;
    if (!(yield* findProjectId(EMPTY_KEY))) {
      yield* projects.createProject(actorId, {
        color: "blue",
        description: null,
        icon: "folder",
        key: EMPTY_KEY,
        name: "UI Fixture Empty",
        status: "planning",
        templateId: "blank",
      });
    }

    const ASSIGNEE_PATTERNS = [[adminId], [employeeId], [adminId, employeeId]];
    let populatedId = yield* findProjectId(POPULATED_KEY);
    if (!populatedId) {
      const populated = yield* projects.createProject(actorId, {
        color: "teal",
        description: "Synthetic fixture project for UI verification.",
        icon: "folder",
        key: POPULATED_KEY,
        name: "UI Fixture Populated Project With A Deliberately Long Display Name For Layout Checks",
        status: "active",
        templateId: "blank",
      });
      populatedId = populated.id;
    }

    const existingTasks = yield* Effect.promise(() =>
      db.orm.public.Task.where({ projectId: populatedId }).select("title").all()
    );
    const existingTitles = new Set(existingTasks.map(({ title }) => title));

    for (let index = 0; index < TASK_COUNT; index += 1) {
      const assigneeIds = ASSIGNEE_PATTERNS[
        index % ASSIGNEE_PATTERNS.length
      ] ?? [adminId];
      const title =
        index === 0
          ? "Long fixture task title to verify wrapping and truncation across every task view, including the drawer and the timeline bar labels"
          : `Fixture task ${index + 1}`;
      if (existingTitles.has(title)) {
        continue;
      }
      yield* work.createTask(actorId, {
        assigneeIds,
        description: null,
        dueDate: isoDate(index - 10),
        priority: PRIORITIES[index % PRIORITIES.length] ?? "none",
        projectId: populatedId,
        title,
      });
      existingTitles.add(title);
    }

    const existingBugReports = yield* Effect.promise(() =>
      db.orm.public.BugReport.where({ projectId: populatedId })
        .select("id")
        .all()
    );
    if (existingBugReports.length === 0) {
      const bugs = yield* BugManagement;
      yield* bugs.reportBug(actorId, {
        actualBehavior:
          "The assignee selector closes and clears the selection after saving.",
        appVersion: "0.1.0-ui-fixture",
        browser: "Chromium",
        component: "Task details drawer",
        description:
          "Synthetic bug report for testing the workspace bug views.",
        device: "Desktop",
        discoverySource: "internal_qa",
        environment: "development",
        expectedBehavior:
          "The selected employee remains assigned after the task is saved.",
        os: "Windows",
        projectId: populatedId,
        reproductionSteps: [
          "Open a task from the project board.",
          "Add an employee in the assignee selector.",
          "Save the task and reopen its details.",
        ],
        route: "/projects/UI-P/tasks",
        severity: "major",
        title: "Task drawer clears the assignee after saving",
      });
      yield* bugs.reportBug(actorId, {
        actualBehavior:
          "Calendar task cards can extend past the viewport on narrow screens.",
        appVersion: "0.1.0-ui-fixture",
        browser: "Chromium mobile emulation",
        component: "Task calendar grid",
        description: "Synthetic bug report for testing severity and filters.",
        device: "Mobile phone",
        discoverySource: "automated_test",
        environment: "test",
        expectedBehavior:
          "Calendar cards remain within the calendar's horizontal scroll area.",
        os: "Android",
        projectId: populatedId,
        reproductionSteps: [
          "Open the project calendar at a 320 pixel viewport width.",
          "Navigate to a week with several overlapping tasks.",
          "Check the task cards at the right edge of the calendar.",
        ],
        route: "/projects/UI-P/calendar",
        severity: "minor",
        title: "Calendar cards overflow on narrow screens",
      });
    }
    process.stdout.write(
      `Seeded ${EMPTY_KEY} (empty) and ${POPULATED_KEY} (${existingTitles.size} tasks).\n`
    );
  });

// Archived items, milestones, a recurring task, a mention and a file. Guarded by
// the archived project, so rerunning the seed adds them once.
const seedExtras = (actorId: string, adminId: string, employeeId: string) =>
  Effect.gen(function* seedExtraFixtures() {
    const projects = yield* ProjectManagement;
    const work = yield* WorkManagement;
    const collaboration = yield* Collaboration;
    const uploads = yield* Uploads;
    if (yield* findProjectId(ARCHIVED_KEY)) {
      process.stdout.write("Extra UI fixtures already seeded.\n");
      return;
    }
    const populatedId = yield* findProjectId(POPULATED_KEY);
    if (!populatedId) {
      throw new Error("Seed the base fixtures before the extras.");
    }

    const archivedTask = yield* work.createTask(actorId, {
      assigneeIds: [adminId],
      description: null,
      dueDate: isoDate(3),
      priority: "low",
      projectId: populatedId,
      title: "Archived fixture task",
    });
    yield* work.archiveTask(actorId, archivedTask.id, archivedTask.version);

    const current = yield* projects.listProjectMilestones(actorId, populatedId);
    yield* projects.saveProjectMilestones(
      actorId,
      populatedId,
      current.version,
      [
        { completed: true, dueDate: isoDate(-3), id: null, name: "Kickoff" },
        { completed: false, dueDate: isoDate(5), id: null, name: "Beta" },
        { completed: false, dueDate: isoDate(12), id: null, name: "Launch" },
        { completed: false, dueDate: null, id: null, name: "Unscheduled" },
      ]
    );

    const recurring = yield* work.createTask(actorId, {
      assigneeIds: [employeeId],
      description: null,
      dueDate: isoDate(2),
      priority: "medium",
      projectId: populatedId,
      title: "Weekly recurring fixture",
    });
    yield* work.setTaskRecurrence(actorId, recurring.id, recurring.version, {
      endsOn: null,
      frequency: "weekly",
      interval: 1,
      weekDays: [1],
    });
    yield* collaboration.createComment(
      actorId,
      recurring.id,
      `Please take a look, @[${employeeId}]`
    );

    const fileText = "Fixture file contents\n";
    const ticket = yield* uploads.requestProjectUpload(actorId, {
      contentType: "text/plain",
      fileName: "fixture-notes.txt",
      projectId: populatedId,
      sizeBytes: Buffer.byteLength(fileText),
    });
    const response = yield* Effect.promise(() =>
      fetch(ticket.uploadUrl, {
        body: fileText,
        headers: ticket.requiredHeaders,
        method: "PUT",
      }).catch(() => null)
    );
    let fileSeeded = false;
    if (response?.ok) {
      yield* uploads.finalizeUpload(actorId, ticket.uploadIntentId);
      fileSeeded = true;
    } else {
      process.stdout.write(
        `Skipped the fixture file: ${response ? `storage answered ${response.status}` : "storage is unavailable"}.\n`
      );
    }
    // Created last: its presence marks the extras as complete.
    const archivedProject = yield* projects.createProject(actorId, {
      color: "orange",
      description: "Archived fixture project.",
      icon: "folder",
      key: ARCHIVED_KEY,
      name: "UI Fixture Archived",
      status: "complete",
      templateId: "blank",
    });
    yield* projects.archiveProject(
      actorId,
      archivedProject.id,
      archivedProject.version
    );

    process.stdout.write(
      `Seeded the archived project and task, milestones, a recurring task, a mention${fileSeeded ? " and a file" : ""}.\n`
    );
  });

const program = Effect.gen(function* seedFixtures() {
  const actorId = yield* Effect.promise(findSeedAdministrator);
  const adminId = yield* Effect.promise(() =>
    findUser(process.env["UI_FIXTURE_ADMIN_EMAIL"] ?? "cibi@admin.metsys.test")
  );
  const employeeId = yield* Effect.promise(() =>
    findUser(
      process.env["UI_FIXTURE_EMPLOYEE_EMAIL"] ?? "cibi@employee.metsys.test"
    )
  );
  yield* seedBase(actorId, adminId, employeeId);
  yield* seedExtras(actorId, adminId, employeeId);
});

try {
  await Effect.runPromise(
    program.pipe(
      Effect.provide(
        Layer.mergeAll(
          ProjectManagementLive,
          WorkManagementLive,
          BugManagementLive,
          CollaborationLive,
          Layer.provide(UploadsLive, StorageLive)
        )
      )
    )
  );
} finally {
  await authPool.end();
}
