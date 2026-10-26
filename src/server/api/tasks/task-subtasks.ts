import { Effect } from "effect";

import { SubtaskResultSchema } from "../../../mobile-api/routes-tasks";
import type {
  MobileSubtaskAddBody,
  MobileSubtaskChangeBody,
  MobileSubtaskResult,
} from "../../../mobile-api/routes-tasks";
import { AuthSession } from "../../auth/session";
import type { AppError } from "../../core/action-result";
import { Idempotency } from "../../core/idempotency";
import {
  addSubtaskFromMobile,
  changeSubtaskFromMobile,
} from "../../tasks/subtask-mobile";

export const addTaskSubtask = (
  headers: Headers,
  taskId: string,
  body: MobileSubtaskAddBody,
  idempotencyKey: string
): Effect.Effect<MobileSubtaskResult, AppError, AuthSession | Idempotency> =>
  Effect.gen(function* resolveAdd() {
    const session = yield* AuthSession;
    const actor = yield* session.requireWorkspaceAccess(headers);
    const idempotency = yield* Idempotency;
    return yield* idempotency.run({
      actorId: actor.id,
      execute: () => addSubtaskFromMobile(actor.id, taskId, body),
      input: { body, taskId },
      key: idempotencyKey,
      operation: "mobile.subtask.add",
      resultSchema: SubtaskResultSchema,
    });
  });

export const changeTaskSubtask = (
  headers: Headers,
  taskId: string,
  subtaskId: string,
  body: MobileSubtaskChangeBody,
  idempotencyKey: string
): Effect.Effect<MobileSubtaskResult, AppError, AuthSession | Idempotency> =>
  Effect.gen(function* resolveChange() {
    const session = yield* AuthSession;
    const actor = yield* session.requireWorkspaceAccess(headers);
    const idempotency = yield* Idempotency;
    return yield* idempotency.run({
      actorId: actor.id,
      execute: () => changeSubtaskFromMobile(actor.id, taskId, subtaskId, body),
      input: { body, subtaskId, taskId },
      key: idempotencyKey,
      operation: "mobile.subtask.change",
      resultSchema: SubtaskResultSchema,
    });
  });
