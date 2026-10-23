import { Effect, Layer } from "effect";

import { db } from "../src/prisma/db";
import "dotenv/config";

import { authPool } from "../src/server/auth/database";
import { CollaborationLive } from "../src/server/collaboration/service";
import { ProjectManagement } from "../src/server/projects/project-contracts";
import { ProjectManagementLive } from "../src/server/projects/project-management";
import { StorageLive } from "../src/server/storage/storage";
import { UploadsLive } from "../src/server/storage/uploads";
import {
  BugManagement,
  BugManagementLive,
} from "../src/server/work/bug-management";
import {
  WorkManagement,
  WorkManagementLive,
} from "../src/server/work/work-management";
import { seedExtras } from "./seed-ui-extras";
import { isoDate, findProjectId } from "./seed-ui-projects";

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
