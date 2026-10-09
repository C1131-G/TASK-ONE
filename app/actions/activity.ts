"use server";

import { Effect, Schema } from "effect";
import { headers } from "next/headers";

import {
  ActivityEntrySchema,
  ActivityManagement,
  ActivityManagementLive,
} from "@/src/server/activity/activity-management";
import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { AppError } from "@/src/server/core/action-result";
import { UUIDSchema } from "@/src/server/core/input-schemas";
import { runServerAction } from "@/src/server/core/server-action";

const ActivityFeedInputSchema = Schema.Struct({
  limit: Schema.optional(
    Schema.Number.check(
      Schema.isInt(),
      Schema.isGreaterThanOrEqualTo(1),
      Schema.isLessThanOrEqualTo(100)
    )
  ),
  projectId: Schema.optional(UUIDSchema),
  taskId: Schema.optional(UUIDSchema),
}).check(
  Schema.makeFilter(({ projectId, taskId }) =>
    projectId || taskId ? undefined : "Choose a task or project activity feed."
  )
);

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function listActivityAction(input: unknown) {
  return await runServerAction(
    input,
    ActivityFeedInputSchema,
    (validated) =>
      Effect.gen(function* listActivity() {
        const requestHeaders = yield* Effect.tryPromise({
          catch: () =>
            new AppError({
              code: "UNAVAILABLE",
              message: "The request could not be completed.",
            }),
          try: () => headers(),
        });
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(requestHeaders);
        const activity = yield* ActivityManagement;
        return yield* activity.list(
          actor.id,
          {
            ...(validated.projectId ? { projectId: validated.projectId } : {}),
            ...(validated.taskId ? { taskId: validated.taskId } : {}),
          },
          validated.limit ?? 50
        );
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(ActivityManagementLive)
      ),
    undefined,
    Schema.Array(ActivityEntrySchema)
  );
}
