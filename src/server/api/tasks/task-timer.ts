import { Effect } from "effect";

import {
  StartedTimerSchema,
  TimeEntryViewSchema,
} from "../../../mobile-api/routes-tasks";
import type {
  MobileMyTimer,
  MobileStartedTimer,
  MobileStartTimerBody,
  MobileTimeEntryView,
} from "../../../mobile-api/routes-tasks";
import { AuthSession } from "../../auth/session";
import type { AppError } from "../../core/action-result";
import { Idempotency } from "../../core/idempotency";
import { TimeTracking } from "../../time/time-tracking";

// The caller's own timer. Every read and write is scoped to the signed-in
// person; there is no task-level timer here.
export const getMyTimer = (
  headers: Headers
): Effect.Effect<MobileMyTimer, AppError, AuthSession | TimeTracking> =>
  Effect.gen(function* resolveTimer() {
    const session = yield* AuthSession;
    const actor = yield* session.requireWorkspaceAccess(headers);
    const time = yield* TimeTracking;
    return { timer: yield* time.runningTimer(actor.id) };
  });

export const startMyTimer = (
  headers: Headers,
  body: MobileStartTimerBody,
  idempotencyKey: string
): Effect.Effect<
  MobileStartedTimer,
  AppError,
  AuthSession | Idempotency | TimeTracking
> =>
  Effect.gen(function* resolveStart() {
    const session = yield* AuthSession;
    const actor = yield* session.requireWorkspaceAccess(headers);
    const idempotency = yield* Idempotency;
    const time = yield* TimeTracking;
    return yield* idempotency.run({
      actorId: actor.id,
      execute: () =>
        time.startTimer(
          actor.id,
          {
            billable: body.billable,
            note: body.note ?? null,
            taskId: body.taskId,
          },
          new Date()
        ),
      input: { body },
      key: idempotencyKey,
      operation: "mobile.timer.start",
      resultSchema: StartedTimerSchema,
    });
  });

export const stopMyTimer = (
  headers: Headers,
  idempotencyKey: string
): Effect.Effect<
  MobileTimeEntryView,
  AppError,
  AuthSession | Idempotency | TimeTracking
> =>
  Effect.gen(function* resolveStop() {
    const session = yield* AuthSession;
    const actor = yield* session.requireWorkspaceAccess(headers);
    const idempotency = yield* Idempotency;
    const time = yield* TimeTracking;
    return yield* idempotency.run({
      actorId: actor.id,
      execute: () => time.stopTimer(actor.id, new Date()),
      input: {},
      key: idempotencyKey,
      operation: "mobile.timer.stop",
      resultSchema: TimeEntryViewSchema,
    });
  });
