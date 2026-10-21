import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { TaskClientVisibility } from "./work-contracts";
import { assertOrdinaryTask, databaseError } from "./work-internal";
import {
  assertTaskEditPermission,
  assertWorkspaceActor,
} from "./work-task-state";

// Chooses whether one task appears (title, status, due date) in the client
// portal's view of its project. Whoever may edit the task may choose; the
// project must also be shared before any client sees it.
export const setTaskClientVisibility = (
  actorId: string,
  taskId: string,
  expectedVersion: number,
  visible: boolean
): Effect.Effect<TaskClientVisibility, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: () =>
      db.transaction(async (transaction) => {
        const actor = await transaction.orm.public.User.where({ id: actorId })
          .select("name", "role", "mustChangePassword", "deactivatedAt")
          .first();
        assertWorkspaceActor(actor);
        const task = await transaction.orm.public.Task.include("project")
          .where({ id: taskId })
          .first();
        if (!task) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The task was not found.",
          });
        }
        assertOrdinaryTask(task);
        if (task.archivedAt || task.project.archivedAt) {
          throw new AppError({
            code: "FORBIDDEN",
            message: "Archived tasks are read only.",
          });
        }
        if (task.version !== expectedVersion) {
          throw new AppError({
            code: "CONFLICT",
            message: "The task changed. Refresh and try again.",
          });
        }
        const assignments = await transaction.orm.public.TaskAssignee.where({
          taskId,
        })
          .select("userId")
          .all();
        assertTaskEditPermission(actor, actorId, task.createdById, assignments);
        const version = expectedVersion + 1;
        const updated = await transaction.orm.public.Task.where({
          id: taskId,
          version: expectedVersion,
        }).updateAndCount({
          clientVisible: visible,
          updatedAt: new Date(),
          version,
        });
        if (!updated) {
          throw new AppError({
            code: "CONFLICT",
            message: "The task changed. Refresh and try again.",
          });
        }
        await transaction.orm.public.Activity.create({
          action: visible
            ? "task.shared_with_clients"
            : "task.hidden_from_clients",
          actorId,
          createdAt: new Date(),
          details: { taskId, version },
          id: randomUUID(),
          projectId: task.projectId,
          taskId,
        });
        return { clientVisible: visible, version };
      }),
  });
