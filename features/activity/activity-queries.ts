import "server-only";
import { Effect, Schema } from "effect";

import {
  ActivityEntrySchema,
  ActivityManagement,
  ActivityManagementLive,
} from "@/src/server/activity/activity-management";
import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { UUIDSchema } from "@/src/server/core/input-schemas";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";

const ActivityFeedInputSchema = Schema.Struct({
  actorId: Schema.optional(UUIDSchema),
  limit: Schema.optional(
    Schema.Number.check(
      Schema.isInt(),
      Schema.isGreaterThanOrEqualTo(1),
      Schema.isLessThanOrEqualTo(100)
    )
  ),
  projectId: Schema.optional(UUIDSchema),
  taskId: Schema.optional(UUIDSchema),
});

export const listActivity = async (input: unknown) =>
  await runServerAction(
    input,
    ActivityFeedInputSchema,
    (validated) =>
      Effect.gen(function* listActivityProgram() {
        const requestHeaders = yield* requestHeadersOrFail;
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(requestHeaders);
        const activity = yield* ActivityManagement;
        return yield* activity.list(
          actor.id,
          {
            ...(validated.actorId ? { actorId: validated.actorId } : {}),
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
