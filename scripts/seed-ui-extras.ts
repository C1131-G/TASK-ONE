import { Effect } from "effect";

import { Collaboration } from "../src/server/collaboration/contracts";
import { ProjectManagement } from "../src/server/projects/project-contracts";
import { Uploads } from "../src/server/storage/uploads-contracts";
import { WorkManagement } from "../src/server/work/work-management";
import { isoDate, findProjectId } from "./seed-ui-projects";
const ARCHIVED_KEY = "UIA";
const POPULATED_KEY = "UIP";
// Archived items, milestones, a recurring task, a mention and a file. Guarded by
// the archived project, so rerunning the seed adds them once.
export const seedExtras = (
  actorId: string,
  adminId: string,
  employeeId: string
) =>
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
