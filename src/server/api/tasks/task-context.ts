import { Effect } from "effect";

import type { MobileTaskContext } from "../../../mobile-api/routes-tasks";
import { AuthSession } from "../../auth/session";
import type { AppError } from "../../core/action-result";
import { getTaskContext } from "../../work/work-task-context";

// One task for staff. Clients never reach it: the session refuses them.
export const readTaskContext = (
  headers: Headers,
  taskId: string
): Effect.Effect<MobileTaskContext, AppError, AuthSession> =>
  Effect.gen(function* resolveTaskContext() {
    const session = yield* AuthSession;
    const actor = yield* session.requireWorkspaceAccess(headers);
    return yield* getTaskContext(actor, taskId);
  });
