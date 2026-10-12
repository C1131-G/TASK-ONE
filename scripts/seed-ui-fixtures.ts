import "dotenv/config";
import { Effect, Layer } from "effect";

import { db } from "../src/prisma/db";
import { ProjectManagement } from "../src/server/projects/project-contracts";
import { ProjectManagementLive } from "../src/server/projects/project-management";
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

const isoDate = (offsetDays: number) => {
  const date = new Date(Date.UTC(2026, 9, 12 + offsetDays));
  return date.toISOString().slice(0, 10);
};

const program = Effect.gen(function* seedFixtures() {
  const projects = yield* ProjectManagement;
  const work = yield* WorkManagement;
  const adminId = yield* Effect.promise(() => findUser("ui-admin@metsys.test"));
  const employeeId = yield* Effect.promise(() =>
    findUser("ui-employee@metsys.test")
  );

  const existing = yield* Effect.promise(() =>
    db.orm.public.Project.where({ key: POPULATED_KEY }).select("id").first()
  );
  if (existing) {
    process.stdout.write("UI fixtures already seeded; nothing to do.\n");
    return;
  }

  yield* projects.createProject(adminId, {
    color: "blue",
    description: null,
    icon: "folder",
    key: EMPTY_KEY,
    name: "UI Fixture Empty",
    status: "planning",
    templateId: "blank",
  });

  const ASSIGNEE_PATTERNS = [[adminId], [employeeId], [adminId, employeeId]];
  const populated = yield* projects.createProject(adminId, {
    color: "teal",
    description: "Synthetic fixture project for UI verification.",
    icon: "folder",
    key: POPULATED_KEY,
    name: "UI Fixture Populated Project With A Deliberately Long Display Name For Layout Checks",
    status: "active",
    templateId: "blank",
  });

  for (let index = 0; index < TASK_COUNT; index += 1) {
    const assigneeIds = ASSIGNEE_PATTERNS[index % ASSIGNEE_PATTERNS.length] ?? [
      adminId,
    ];
    const title =
      index === 0
        ? "Long fixture task title to verify wrapping and truncation across every task view, including the drawer and the timeline bar labels"
        : `Fixture task ${index + 1}`;
    yield* work.createTask(adminId, {
      assigneeIds,
      description: null,
      dueDate: isoDate(index - 10),
      priority: PRIORITIES[index % PRIORITIES.length] ?? "none",
      projectId: populated.id,
      title,
    });
  }
  process.stdout.write(
    `Seeded ${EMPTY_KEY} (empty) and ${POPULATED_KEY} (${TASK_COUNT} tasks).\n`
  );
});

await Effect.runPromise(
  program.pipe(
    Effect.provide(Layer.mergeAll(ProjectManagementLive, WorkManagementLive))
  )
);
