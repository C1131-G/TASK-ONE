import "server-only";
import { Effect, Schema } from "effect";
import { refresh } from "next/cache";

import { getUtcToday } from "@/src/lib/utc-today";
import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { Idempotency, IdempotencyLive } from "@/src/server/core/idempotency";
import {
  IdempotencyKeySchema,
  UUIDSchema,
} from "@/src/server/core/input-schemas";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import {
  TaskCsv,
  TaskCsvFiltersSchema,
  TaskCsvLive,
} from "@/src/server/tasks/task-csv";

// Larger than the importer accepts, so an oversized file gets the importer's
// readable "too large" message instead of a generic validation failure.
const MAX_IMPORT_FIELD_LENGTH = 2_000_000;

const CsvTextSchema = Schema.String;

const ImportResultSchema = Schema.Struct({
  created: Schema.Number,
  errors: Schema.Array(
    Schema.Struct({
      column: Schema.NullOr(Schema.String),
      line: Schema.Number,
      message: Schema.String,
    })
  ),
});

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function getTasksCsvExportAction(input: unknown) {
  return await runServerAction(
    input,
    TaskCsvFiltersSchema,
    (filters) =>
      Effect.gen(function* exportTasks() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const csv = yield* TaskCsv;
        return yield* csv.exportTasks(actor.id, filters, getUtcToday());
      }).pipe(Effect.provide(AuthSessionLive), Effect.provide(TaskCsvLive)),
    undefined,
    CsvTextSchema
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function importTasksCsvAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      idempotencyKey: IdempotencyKeySchema,
      projectId: UUIDSchema,
      text: Schema.String.check(Schema.isMaxLength(MAX_IMPORT_FIELD_LENGTH)),
    }),
    (validated) =>
      Effect.gen(function* importTasks() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const csv = yield* TaskCsv;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: actor.id,
          execute: () =>
            csv.importTasks(actor.id, validated.projectId, validated.text),
          input: { projectId: validated.projectId, text: validated.text },
          key: validated.idempotencyKey,
          operation: "task.importCsv",
          resultSchema: ImportResultSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(TaskCsvLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    ImportResultSchema
  );
  if (result.ok && result.data.created > 0) {
    refresh();
  }
  return result;
}
