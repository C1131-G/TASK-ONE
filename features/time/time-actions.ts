"use server";

import { Effect, Schema } from "effect";
import { refresh, revalidatePath } from "next/cache";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import type { ActionResult, AppError } from "@/src/server/core/action-result";
import {
  DoneResultSchema,
  Idempotency,
  IdempotencyLive,
} from "@/src/server/core/idempotency";
import {
  IdempotencyKeySchema,
  UUIDSchema,
} from "@/src/server/core/input-schemas";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import {
  ProjectRangeSchema,
  StartedTimerSchema,
  TimeEntryChangesSchema,
  TimeEntryViewSchema,
} from "@/src/server/time/time-contracts";
import {
  TimeTracking,
  TimeTrackingLive,
} from "@/src/server/time/time-tracking";

type TimeService = TimeTracking["Service"];

const MyTimePath = "/my-time";
const NoteSchema = Schema.NullOr(Schema.String);

// Signs the caller in as an employee, then runs one replay-safe mutation. A
// repeated idempotency key returns the first result instead of logging twice.
const runTimeMutation = async <
  InputSchema extends Schema.Codec<
    { readonly idempotencyKey: string },
    unknown,
    never,
    never
  >,
  OutputSchema extends Schema.Codec<unknown, unknown, never, never>,
>(
  input: unknown,
  schema: InputSchema,
  operation: string,
  execute: (
    time: TimeService,
    actorId: string,
    validated: InputSchema["Type"]
  ) => Effect.Effect<OutputSchema["Type"], AppError>,
  outputSchema: OutputSchema
): Promise<ActionResult<OutputSchema["Type"]>> => {
  const result = await runServerAction(
    input,
    schema,
    (validated) =>
      Effect.gen(function* run() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const time = yield* TimeTracking;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...rest } = validated;
        return yield* idempotency.run({
          actorId: actor.id,
          execute: () => execute(time, actor.id, validated),
          input: rest,
          key: idempotencyKey,
          operation,
          resultSchema: outputSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(TimeTrackingLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    outputSchema
  );
  if (result.ok) {
    revalidatePath(MyTimePath);
    refresh();
  }
  return result;
};

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function startTimerAction(input: unknown) {
  return await runTimeMutation(
    input,
    Schema.Struct({
      billable: Schema.Boolean,
      idempotencyKey: IdempotencyKeySchema,
      note: NoteSchema,
      taskId: UUIDSchema,
    }),
    "time.startTimer",
    (time, actorId, { billable, note, taskId }) =>
      time.startTimer(actorId, { billable, note, taskId }, new Date()),
    StartedTimerSchema
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function stopTimerAction(input: unknown) {
  return await runTimeMutation(
    input,
    Schema.Struct({ idempotencyKey: IdempotencyKeySchema }),
    "time.stopTimer",
    (time, actorId) => time.stopTimer(actorId, new Date()),
    TimeEntryViewSchema
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function addTimeEntryAction(input: unknown) {
  return await runTimeMutation(
    input,
    Schema.Struct({
      ...TimeEntryChangesSchema.fields,
      idempotencyKey: IdempotencyKeySchema,
      taskId: UUIDSchema,
    }),
    "time.addEntry",
    (time, actorId, { billable, minutes, note, taskId, workDate }) =>
      time.addEntry(actorId, { billable, minutes, note, taskId, workDate }),
    TimeEntryViewSchema
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function updateTimeEntryAction(input: unknown) {
  return await runTimeMutation(
    input,
    Schema.Struct({
      ...TimeEntryChangesSchema.fields,
      entryId: UUIDSchema,
      idempotencyKey: IdempotencyKeySchema,
    }),
    "time.updateEntry",
    (time, actorId, { entryId, billable, minutes, note, workDate }) =>
      time.updateEntry(actorId, entryId, { billable, minutes, note, workDate }),
    TimeEntryViewSchema
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function deleteTimeEntryAction(input: unknown) {
  return await runTimeMutation(
    input,
    Schema.Struct({
      entryId: UUIDSchema,
      idempotencyKey: IdempotencyKeySchema,
    }),
    "time.deleteEntry",
    (time, actorId, { entryId }) =>
      Effect.map(time.deleteEntry(actorId, entryId), () => ({
        done: true as const,
      })),
    DoneResultSchema
  );
}

// The project's time as CSV text, for the report's download button.
// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function getProjectTimeCsvAction(input: unknown) {
  return await runServerAction(
    input,
    ProjectRangeSchema,
    ({ projectId, ...range }) =>
      Effect.gen(function* exportTime() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const time = yield* TimeTracking;
        return yield* time.projectReportCsv(actor.id, projectId, range);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(TimeTrackingLive)
      ),
    undefined,
    Schema.String
  );
}
