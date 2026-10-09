"use server";

import { Effect, Schema } from "effect";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { AppError } from "@/src/server/core/action-result";
import {
  DoneResultSchema,
  Idempotency,
  IdempotencyLive,
} from "@/src/server/core/idempotency";
import {
  IdempotencyKeySchema,
  UUIDSchema,
} from "@/src/server/core/input-schemas";
import { runServerAction } from "@/src/server/core/server-action";
import {
  SavedViewManagement,
  SavedViewManagementLive,
  SavedViewSummarySchema,
} from "@/src/server/preferences/saved-view-management";

const SavedViewInputSchema = Schema.Struct({
  filters: Schema.Json,
  groupBy: Schema.NullOr(Schema.String),
  hiddenColumns: Schema.Json,
  isShared: Schema.Boolean,
  name: Schema.String,
  projectId: Schema.NullOr(UUIDSchema),
  sort: Schema.Json,
  type: Schema.Literals(["board", "list", "table", "calendar", "timeline"]),
});

const getRequestHeaders = () =>
  Effect.tryPromise({
    catch: () =>
      new AppError({
        code: "UNAVAILABLE",
        message: "The request could not be completed.",
      }),
    try: () => headers(),
  });

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function listSavedViewsAction(input: unknown) {
  const result = await runServerAction(input, Schema.Struct({}), () =>
    Effect.gen(function* listViews() {
      const requestHeaders = yield* getRequestHeaders();
      const sessions = yield* AuthSession;
      const user = yield* sessions.requireWorkspaceAccess(requestHeaders);
      const views = yield* SavedViewManagement;
      return yield* views.listViews(user.id);
    }).pipe(
      Effect.provide(AuthSessionLive),
      Effect.provide(SavedViewManagementLive)
    )
  );
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function createSavedViewAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      idempotencyKey: IdempotencyKeySchema,
      view: SavedViewInputSchema,
    }),
    (validated) =>
      Effect.gen(function* createView() {
        const requestHeaders = yield* getRequestHeaders();
        const sessions = yield* AuthSession;
        const user = yield* sessions.requireWorkspaceAccess(requestHeaders);
        const views = yield* SavedViewManagement;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () => views.createView(user.id, validated.view),
          input: validated.view,
          key: validated.idempotencyKey,
          operation: "savedView.create",
          resultSchema: SavedViewSummarySchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(SavedViewManagementLive),
        Effect.provide(IdempotencyLive)
      )
  );
  if (result.ok) {
    revalidatePath("/");
    revalidatePath("/projects");
    revalidatePath("/tasks");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function updateSavedViewAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      idempotencyKey: IdempotencyKeySchema,
      view: SavedViewInputSchema,
      viewId: Schema.String,
    }),
    (validated) =>
      Effect.gen(function* updateView() {
        const requestHeaders = yield* getRequestHeaders();
        const sessions = yield* AuthSession;
        const user = yield* sessions.requireWorkspaceAccess(requestHeaders);
        const views = yield* SavedViewManagement;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () =>
            views.updateView(user.id, validated.viewId, validated.view),
          input: { view: validated.view, viewId: validated.viewId },
          key: validated.idempotencyKey,
          operation: "savedView.update",
          resultSchema: SavedViewSummarySchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(SavedViewManagementLive),
        Effect.provide(IdempotencyLive)
      )
  );
  if (result.ok) {
    revalidatePath("/");
    revalidatePath("/projects");
    revalidatePath("/tasks");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function deleteSavedViewAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      idempotencyKey: IdempotencyKeySchema,
      viewId: Schema.String,
    }),
    (validated) =>
      Effect.gen(function* deleteView() {
        const requestHeaders = yield* getRequestHeaders();
        const sessions = yield* AuthSession;
        const user = yield* sessions.requireWorkspaceAccess(requestHeaders);
        const views = yield* SavedViewManagement;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () =>
            views
              .deleteView(user.id, validated.viewId)
              .pipe(Effect.map(() => ({ done: true as const }))),
          input: { viewId: validated.viewId },
          key: validated.idempotencyKey,
          operation: "savedView.delete",
          resultSchema: DoneResultSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(SavedViewManagementLive),
        Effect.provide(IdempotencyLive)
      )
  );
  if (result.ok) {
    revalidatePath("/");
    revalidatePath("/projects");
    revalidatePath("/tasks");
  }
  return result;
}
