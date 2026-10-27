import { Effect } from "effect";

import { db } from "../src/prisma/db";
import { Collaboration } from "../src/server/collaboration/contracts";
import { WorkManagement } from "../src/server/work/work-management";
import { isoDate, findProjectId } from "./seed-ui-projects";

const POPULATED_KEY = "UIP";
const NOTIFIED_TASK_TITLE = "Inbox fixture task";

// Gives one account an assignment, a comment and a mention, which the inbox
// specs read. Found by its task, so rerunning the seed adds them once.
export const seedNotifications = (actorId: string, notifiedId: string) =>
  Effect.gen(function* seedNotificationFixtures() {
    const work = yield* WorkManagement;
    const collaboration = yield* Collaboration;
    const populatedId = yield* findProjectId(POPULATED_KEY);
    if (!populatedId) {
      throw new Error("Seed the base fixtures before the notifications.");
    }
    const existing = yield* Effect.promise(() =>
      db.orm.public.Task.where({
        projectId: populatedId,
        title: NOTIFIED_TASK_TITLE,
      })
        .select("id")
        .first()
    );
    if (existing) {
      process.stdout.write("Notification fixtures already seeded.\n");
      return;
    }
    const task = yield* work.createTask(actorId, {
      assigneeIds: [notifiedId],
      description: null,
      dueDate: isoDate(4),
      priority: "medium",
      projectId: populatedId,
      title: NOTIFIED_TASK_TITLE,
    });
    yield* collaboration.createComment(
      actorId,
      task.id,
      "Please confirm the scope."
    );
    yield* collaboration.createComment(
      actorId,
      task.id,
      `Can you look at this, @[${notifiedId}]`
    );
    process.stdout.write(
      "Seeded an assignment, a comment and a mention for the inbox.\n"
    );
  });
