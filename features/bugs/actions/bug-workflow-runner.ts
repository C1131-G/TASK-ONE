import type { Schema } from "effect";
import { Effect } from "effect";
import { revalidatePath } from "next/cache";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import type { AppError } from "@/src/server/core/action-result";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import type { BugWorkflowManagement } from "@/src/server/work/bug-workflow-management";
import {
  BugWorkflowManagementLive,
  BugWorkflowReceiptSchema,
} from "@/src/server/work/bug-workflow-management";

export const runBugWorkflowAction = <
  InputSchema extends Schema.Codec<unknown, unknown, never, never>,
>(
  input: unknown,
  schema: InputSchema,
  execute: (
    actorId: string,
    validated: InputSchema["Type"]
  ) => Effect.Effect<
    typeof BugWorkflowReceiptSchema.Type,
    AppError,
    BugWorkflowManagement
  >
) =>
  runServerAction(
    input,
    schema,
    (validated) =>
      Effect.gen(function* runBugWorkflow() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        return yield* execute(actor.id, validated);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(BugWorkflowManagementLive)
      ),
    undefined,
    BugWorkflowReceiptSchema
  );

// eslint-disable-next-line require-await -- Preserve an async action result helper for .then composition.
export const revalidateBugViews = async <
  Result extends { readonly ok: boolean },
>(
  result: Result
): Promise<Result> => {
  if (result.ok) {
    revalidatePath("/bugs");
    revalidatePath("/bug-approvals");
  }
  return result;
};
