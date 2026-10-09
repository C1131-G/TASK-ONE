"use server";

import { Effect, Schema } from "effect";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import {
  Collaboration,
  CollaborationLive,
  CommentListSchema,
  CommentReactionResultSchema,
  CommentUndoneResultSchema,
  CreatedCommentSchema,
  UndoReceiptSchema,
} from "@/src/server/collaboration/service";
import { AppError } from "@/src/server/core/action-result";
import type { ActionResult } from "@/src/server/core/action-result";
import { Idempotency, IdempotencyLive } from "@/src/server/core/idempotency";
import {
  IdempotencyKeySchema,
  UUIDSchema,
} from "@/src/server/core/input-schemas";
import { runServerAction } from "@/src/server/core/server-action";

const runCollaborationAction = <
  InputSchema extends Schema.Codec<unknown, unknown, never, never>,
  Result,
>(
  input: unknown,
  schema: InputSchema,
  execute: (
    actorId: string,
    validated: InputSchema["Type"]
  ) => Effect.Effect<Result, AppError, Collaboration | Idempotency>,
  outputSchema?: Schema.Codec<unknown, unknown, never, never>
): Promise<ActionResult<Result>> =>
  runServerAction(
    input,
    schema,
    (validated) =>
      Effect.gen(function* authorizeCommentAction() {
        const requestHeaders = yield* Effect.tryPromise({
          catch: () =>
            new AppError({
              code: "UNAVAILABLE",
              message: "The request could not be completed.",
            }),
          try: () => headers(),
        });
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(requestHeaders);
        return yield* execute(actor.id, validated).pipe(
          Effect.provide(CollaborationLive),
          Effect.provide(IdempotencyLive)
        );
      }).pipe(Effect.provide(AuthSessionLive)),
    undefined,
    outputSchema
  );

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function listTaskCommentsAction(input: unknown) {
  return await runCollaborationAction(
    input,
    Schema.Struct({ taskId: UUIDSchema }),
    (actorId, validated) =>
      Effect.gen(function* listTaskComments() {
        const collaboration = yield* Collaboration;
        return yield* collaboration.listComments(actorId, validated.taskId);
      }),
    CommentListSchema
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function createCommentAction(input: unknown) {
  const result = await runCollaborationAction(
    input,
    Schema.Struct({
      body: Schema.String,
      idempotencyKey: IdempotencyKeySchema,
      taskId: UUIDSchema,
    }),
    (actorId, validated) =>
      Effect.gen(function* createComment() {
        const collaboration = yield* Collaboration;
        const idempotency = yield* Idempotency;
        const commentInput = { body: validated.body, taskId: validated.taskId };
        return yield* idempotency.run({
          actorId,
          execute: () =>
            collaboration.createComment(
              actorId,
              validated.taskId,
              validated.body
            ),
          input: commentInput,
          key: validated.idempotencyKey,
          operation: "comment.create",
          resultSchema: CreatedCommentSchema,
        });
      })
  );

  if (result.ok) {
    revalidatePath(`/tasks/${result.data.taskId}`);
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function removeCommentAction(input: unknown) {
  const result = await runCollaborationAction(
    input,
    Schema.Struct({
      commentId: UUIDSchema,
      idempotencyKey: IdempotencyKeySchema,
    }),
    (actorId, validated) =>
      Effect.gen(function* removeComment() {
        const collaboration = yield* Collaboration;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId,
          execute: () =>
            collaboration.removeComment(actorId, validated.commentId),
          input: { commentId: validated.commentId },
          key: validated.idempotencyKey,
          operation: "comment.remove",
          resultSchema: UndoReceiptSchema,
        });
      })
  );

  if (result.ok) {
    revalidatePath("/tasks");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function undoCommentRemovalAction(input: unknown) {
  const result = await runCollaborationAction(
    input,
    Schema.Struct({
      idempotencyKey: IdempotencyKeySchema,
      undoId: UUIDSchema,
    }),
    (actorId, validated) =>
      Effect.gen(function* undoCommentRemoval() {
        const collaboration = yield* Collaboration;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId,
          execute: () =>
            collaboration
              .undoCommentRemoval(actorId, validated.undoId)
              .pipe(Effect.map(() => ({ undone: true as const }))),
          input: { undoId: validated.undoId },
          key: validated.idempotencyKey,
          operation: "comment.undoRemoval",
          resultSchema: CommentUndoneResultSchema,
        });
      })
  );

  if (result.ok) {
    revalidatePath("/tasks");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function toggleCommentReactionAction(input: unknown) {
  const result = await runCollaborationAction(
    input,
    Schema.Struct({
      commentId: UUIDSchema,
      emoji: Schema.String,
      idempotencyKey: IdempotencyKeySchema,
    }),
    (actorId, validated) =>
      Effect.gen(function* toggleCommentReaction() {
        const collaboration = yield* Collaboration;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId,
          execute: () =>
            collaboration.toggleReaction(
              actorId,
              validated.commentId,
              validated.emoji
            ),
          input: { commentId: validated.commentId, emoji: validated.emoji },
          key: validated.idempotencyKey,
          operation: "comment.toggleReaction",
          resultSchema: CommentReactionResultSchema,
        });
      })
  );

  if (result.ok) {
    revalidatePath("/tasks");
  }
  return result;
}
