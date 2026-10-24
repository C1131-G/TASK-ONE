import { Effect } from "effect";

import { TaskChangeSchema } from "../../../mobile-api/routes-tasks";
import type {
  MobileTaskChange,
  MobileTaskChangeBody,
} from "../../../mobile-api/routes-tasks";
import { AuthSession } from "../../auth/session";
import type { AppError } from "../../core/action-result";
import { Idempotency } from "../../core/idempotency";
import { quickUpdateTask } from "../../work/work-task-quick-update";

// Staff only. The caller's id comes from the session, never from the body.
export const changeTask = (
  headers: Headers,
  taskId: string,
  body: MobileTaskChangeBody,
  idempotencyKey: string
): Effect.Effect<MobileTaskChange, AppError, AuthSession | Idempotency> =>
  Effect.gen(function* resolveChange() {
    const session = yield* AuthSession;
    const actor = yield* session.requireWorkspaceAccess(headers);
    const idempotency = yield* Idempotency;
    const { expectedVersion, ...change } = body;
    return yield* idempotency.run({
      actorId: actor.id,
      execute: () => quickUpdateTask(actor.id, taskId, expectedVersion, change),
      input: { change, expectedVersion, taskId },
      key: idempotencyKey,
      operation: "mobile.task.change",
      resultSchema: TaskChangeSchema,
    });
  });
