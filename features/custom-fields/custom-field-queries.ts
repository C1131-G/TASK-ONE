import "server-only";
import { Effect, Schema } from "effect";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { UUIDSchema } from "@/src/server/core/input-schemas";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import {
  CustomFieldListSchema,
  CustomFields,
  TaskCustomFieldsSchema,
} from "@/src/server/custom-fields/custom-field-contracts";
import { CustomFieldsLive } from "@/src/server/custom-fields/custom-fields";

// Staff only: the active fields of one project, in display order.
export const listProjectCustomFields = async (input: unknown) =>
  await runServerAction(
    input,
    Schema.Struct({ projectId: UUIDSchema }),
    ({ projectId }) =>
      Effect.gen(function* projectFields() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const fields = yield* CustomFields;
        return yield* fields.listForProject(actor.id, projectId);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(CustomFieldsLive)
      ),
    undefined,
    CustomFieldListSchema
  );

// Staff only: a task's project fields with the task's values. Clients never
// reach this read.
export const getTaskCustomFields = async (input: unknown) =>
  await runServerAction(
    input,
    Schema.Struct({ taskId: UUIDSchema }),
    ({ taskId }) =>
      Effect.gen(function* taskFields() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const fields = yield* CustomFields;
        return yield* fields.forTask(actor.id, taskId);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(CustomFieldsLive)
      ),
    undefined,
    TaskCustomFieldsSchema
  );
