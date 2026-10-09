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
  LabelColorSchema,
  UUIDSchema,
} from "@/src/server/core/input-schemas";
import { runServerAction } from "@/src/server/core/server-action";
import {
  LabelManagement,
  LabelManagementLive,
  LabelSummarySchema,
} from "@/src/server/tasks/label-management";

const LabelInputSchema = Schema.Struct({
  color: LabelColorSchema,
  name: Schema.String.check(
    Schema.makeFilter((value) =>
      value.trim().length > 0 && value.length <= 50
        ? undefined
        : "Label names must be between 1 and 50 characters."
    )
  ),
});
const getHeaders = () =>
  Effect.tryPromise({
    catch: () =>
      new AppError({ code: "UNAVAILABLE", message: "Request failed." }),
    try: () => headers(),
  });

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function listLabelsAction(input: unknown) {
  return await runServerAction(input, Schema.Struct({}), () =>
    Effect.gen(function* listLabels() {
      const requestHeaders = yield* getHeaders();
      const sessions = yield* AuthSession;
      const user = yield* sessions.requireWorkspaceAccess(requestHeaders);
      const labels = yield* LabelManagement;
      return yield* labels.list(user.id);
    }).pipe(
      Effect.provide(AuthSessionLive),
      Effect.provide(LabelManagementLive)
    )
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function createLabelAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      ...LabelInputSchema.fields,
      idempotencyKey: IdempotencyKeySchema,
    }),
    (validated) =>
      Effect.gen(function* createLabel() {
        const requestHeaders = yield* getHeaders();
        const sessions = yield* AuthSession;
        const user = yield* sessions.requireWorkspaceAccess(requestHeaders);
        const labels = yield* LabelManagement;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...labelInput } = validated;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () => labels.create(user.id, labelInput),
          input: labelInput,
          key: idempotencyKey,
          operation: "label.create",
          resultSchema: LabelSummarySchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(LabelManagementLive),
        Effect.provide(IdempotencyLive)
      )
  );
  if (result.ok) {
    revalidatePath("/");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function updateLabelAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      idempotencyKey: IdempotencyKeySchema,
      label: LabelInputSchema,
      labelId: UUIDSchema,
    }),
    (validated) =>
      Effect.gen(function* updateLabel() {
        const requestHeaders = yield* getHeaders();
        const sessions = yield* AuthSession;
        const user = yield* sessions.requireWorkspaceAccess(requestHeaders);
        const labels = yield* LabelManagement;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () =>
            labels.update(user.id, validated.labelId, validated.label),
          input: { label: validated.label, labelId: validated.labelId },
          key: validated.idempotencyKey,
          operation: "label.update",
          resultSchema: LabelSummarySchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(LabelManagementLive),
        Effect.provide(IdempotencyLive)
      )
  );
  if (result.ok) {
    revalidatePath("/");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function removeLabelAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      idempotencyKey: IdempotencyKeySchema,
      labelId: UUIDSchema,
    }),
    (validated) =>
      Effect.gen(function* removeLabel() {
        const requestHeaders = yield* getHeaders();
        const sessions = yield* AuthSession;
        const user = yield* sessions.requireWorkspaceAccess(requestHeaders);
        const labels = yield* LabelManagement;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () =>
            labels
              .remove(user.id, validated.labelId)
              .pipe(Effect.map(() => ({ done: true as const }))),
          input: { labelId: validated.labelId },
          key: validated.idempotencyKey,
          operation: "label.remove",
          resultSchema: DoneResultSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(LabelManagementLive),
        Effect.provide(IdempotencyLive)
      )
  );
  if (result.ok) {
    revalidatePath("/");
  }
  return result;
}
