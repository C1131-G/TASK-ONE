import { Context, Effect, Layer, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { CLIENT_CONTEXT_ACTION } from "../portal/portal-browser-context";

export const ActivityEntrySchema = Schema.Struct({
  action: Schema.String,
  actorId: Schema.String,
  actorName: Schema.String,
  createdAt: Schema.String,
  details: Schema.NullOr(Schema.Json),
  id: Schema.String,
  projectId: Schema.NullOr(Schema.String),
  projectName: Schema.NullOr(Schema.String),
  taskId: Schema.NullOr(Schema.String),
  taskTitle: Schema.NullOr(Schema.String),
});

export type ActivityEntry = typeof ActivityEntrySchema.Type;

export class ActivityManagement extends Context.Service<
  ActivityManagement,
  {
    readonly list: (
      actorId: string,
      scope: {
        readonly actorId?: string;
        readonly projectId?: string;
        readonly taskId?: string;
      },
      limit: number
    ) => Effect.Effect<readonly ActivityEntry[], AppError>;
  }
>()("metsys/server/ActivityManagement") {}

const list: ActivityManagement["Service"]["list"] = (
  actorId,
  scope,
  requestedLimit
) =>
  Effect.tryPromise({
    catch: () =>
      new AppError({
        code: "UNAVAILABLE",
        message: "The activity feed could not be loaded.",
      }),
    try: async () => {
      const actor = await db.orm.public.User.where({ id: actorId })
        .select("deactivatedAt", "mustChangePassword")
        .first();
      if (!actor || actor.deactivatedAt) {
        throw new AppError({
          code: "UNAUTHENTICATED",
          message: "Sign in to continue.",
        });
      }
      if (actor.mustChangePassword) {
        throw new AppError({
          code: "FORBIDDEN",
          message: "Change your password before continuing.",
        });
      }
      if (
        !Number.isSafeInteger(requestedLimit) ||
        requestedLimit < 1 ||
        requestedLimit > 100 ||
        (scope.projectId !== undefined &&
          !Schema.is(Schema.String.check(Schema.isUUID()))(scope.projectId)) ||
        (scope.taskId !== undefined &&
          !Schema.is(Schema.String.check(Schema.isUUID()))(scope.taskId)) ||
        (scope.actorId !== undefined &&
          !Schema.is(Schema.String.check(Schema.isUUID()))(scope.actorId))
      ) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "Choose a valid activity feed and page size.",
        });
      }
      // A reporter's browser context is shown on the bug, not in the feeds.
      const activityQuery = db.orm.public.Activity.where((activity) =>
        activity.action.neq(CLIENT_CONTEXT_ACTION)
      )
        .include("actor")
        .include("task")
        .include("project");
      let scopedActivity = activityQuery;
      if (scope.actorId) {
        scopedActivity = scopedActivity.where({ actorId: scope.actorId });
      }
      if (scope.taskId) {
        scopedActivity = scopedActivity.where({ taskId: scope.taskId });
      }
      if (scope.projectId) {
        scopedActivity = scopedActivity.where({ projectId: scope.projectId });
      }
      const rows = await scopedActivity
        .orderBy((row) => row.createdAt.desc())
        .limit(requestedLimit)
        .all();
      return rows.map((activity) => ({
        action: activity.action,
        actorId: activity.actorId,
        actorName: activity.actor.name,
        createdAt: activity.createdAt.toISOString(),
        details: activity.details,
        id: activity.id,
        projectId: activity.projectId,
        projectName: activity.project?.name ?? null,
        taskId: activity.taskId,
        taskTitle: activity.task?.title ?? null,
      }));
    },
  });

export const ActivityManagementLive = Layer.succeed(
  ActivityManagement,
  ActivityManagement.of({ list })
);
