import "dotenv/config";
import { Effect, Layer } from "effect";

import { db } from "../src/prisma/db";
import { Collaboration } from "../src/server/collaboration/contracts";
import { CollaborationLive } from "../src/server/collaboration/service";
import { ProjectManagement } from "../src/server/projects/project-contracts";
import { ProjectManagementLive } from "../src/server/projects/project-management";
import { StorageLive } from "../src/server/storage/storage";
import { UploadsLive } from "../src/server/storage/uploads";
import { Uploads } from "../src/server/storage/uploads-contracts";
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

const seedBase = (adminId: string, employeeId: string) =>
  Effect.gen(function* seedBaseFixtures() {
    const projects = yield* ProjectManagement;
    const work = yield* WorkManagement;
    if (yield* findProjectId(POPULATED_KEY)) {
      process.stdout.write("Base UI fixtures already seeded.\n");
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
      const assigneeIds = ASSIGNEE_PATTERNS[
        index % ASSIGNEE_PATTERNS.length
      ] ?? [adminId];
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

// Archived items, milestones, a recurring task, a mention and a file. Guarded by
// the archived project, so rerunning the seed adds them once.
const seedExtras = (adminId: string, employeeId: string) =>
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

    const archivedTask = yield* work.createTask(adminId, {
      assigneeIds: [adminId],
      description: null,
      dueDate: isoDate(3),
      priority: "low",
      projectId: populatedId,
      title: "Archived fixture task",
    });
    yield* work.archiveTask(adminId, archivedTask.id, archivedTask.version);

    const current = yield* projects.listProjectMilestones(adminId, populatedId);
    yield* projects.saveProjectMilestones(
      adminId,
      populatedId,
      current.version,
      [
        { completed: true, dueDate: isoDate(-3), id: null, name: "Kickoff" },
        { completed: false, dueDate: isoDate(5), id: null, name: "Beta" },
        { completed: false, dueDate: isoDate(12), id: null, name: "Launch" },
        { completed: false, dueDate: null, id: null, name: "Unscheduled" },
      ]
    );

    const recurring = yield* work.createTask(adminId, {
      assigneeIds: [employeeId],
      description: null,
      dueDate: isoDate(2),
      priority: "medium",
      projectId: populatedId,
      title: "Weekly recurring fixture",
    });
    yield* work.setTaskRecurrence(adminId, recurring.id, recurring.version, {
      endsOn: null,
      frequency: "weekly",
      interval: 1,
      weekDays: [1],
    });
    yield* collaboration.createComment(
      adminId,
      recurring.id,
      `Please take a look, @[${employeeId}]`
    );

    const fileText = "Fixture file contents\n";
    const ticket = yield* uploads.requestProjectUpload(adminId, {
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
      })
    );
    if (response.ok) {
      yield* uploads.finalizeUpload(adminId, ticket.uploadIntentId);
    } else {
      process.stdout.write(
        `Skipped the fixture file: storage answered ${response.status}.\n`
      );
    }
    // Created last: its presence marks the extras as complete.
    const archivedProject = yield* projects.createProject(adminId, {
      color: "orange",
      description: "Archived fixture project.",
      icon: "folder",
      key: ARCHIVED_KEY,
      name: "UI Fixture Archived",
      status: "complete",
      templateId: "blank",
    });
    yield* projects.archiveProject(
      adminId,
      archivedProject.id,
      archivedProject.version
    );

    process.stdout.write(
      "Seeded the archived project and task, milestones, a recurring task, a mention and a file.\n"
    );
  });

const program = Effect.gen(function* seedFixtures() {
  const adminId = yield* Effect.promise(() => findUser("ui-admin@metsys.test"));
  const employeeId = yield* Effect.promise(() =>
    findUser("ui-employee@metsys.test")
  );
  yield* seedBase(adminId, employeeId);
  yield* seedExtras(adminId, employeeId);
});

await Effect.runPromise(
  program.pipe(
    Effect.provide(
      Layer.mergeAll(
        ProjectManagementLive,
        WorkManagementLive,
        CollaborationLive,
        Layer.provide(UploadsLive, StorageLive)
      )
    )
  )
);
