import { Effect } from "effect";

import { TaskCommentSchema } from "../../../mobile-api/routes-tasks";
import type {
  MobileTaskComment,
  MobileTaskCommentBody,
} from "../../../mobile-api/routes-tasks";
import { AuthSession } from "../../auth/session";
import { createComment } from "../../collaboration/create-comment";
import type { AppError } from "../../core/action-result";
import { Idempotency } from "../../core/idempotency";

// Staff only. The author is the signed-in caller, never the body. The comment
// service keeps the client-bug and mention rules; this adapter only names the
// operation so a retry replays the same comment.
export const addTaskComment = (
  headers: Headers,
  taskId: string,
  body: MobileTaskCommentBody,
  idempotencyKey: string
): Effect.Effect<MobileTaskComment, AppError, AuthSession | Idempotency> =>
  Effect.gen(function* resolveComment() {
    const session = yield* AuthSession;
    const actor = yield* session.requireWorkspaceAccess(headers);
    const idempotency = yield* Idempotency;
    return yield* idempotency.run({
      actorId: actor.id,
      execute: () =>
        createComment(
          actor.id,
          taskId,
          body.body,
          body.visibility ?? "internal"
        ),
      input: { body, taskId },
      key: idempotencyKey,
      operation: "mobile.comment.add",
      resultSchema: TaskCommentSchema,
    });
  });
