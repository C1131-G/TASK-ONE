import "server-only";
import { Effect, Schema } from "effect";
import { refresh, revalidatePath } from "next/cache";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import {
  Collaboration,
  CollaborationLive,
  CommentListSchema,
  CommentReactionResultSchema,
  CommentUndoneResultSchema,
  CommentVisibilitySchema,
  CreatedCommentSchema,
  UndoReceiptSchema,
} from "@/src/server/collaboration/service";
import type { ActionResult, AppError } from "@/src/server/core/action-result";
import { Idempotency, IdempotencyLive } from "@/src/server/core/idempotency";
import {
  IdempotencyKeySchema,
  UUIDSchema,
} from "@/src/server/core/input-schemas";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";

const runCollaborationAction = <
  InputSchema extends Schema.Codec<unknown, unknown, never, never>,
  OutputSchema extends Schema.Codec<unknown, unknown, never, never>,
>(
  input: unknown,
  schema: InputSchema,
  execute: (
    actorId: string,
    validated: InputSchema["Type"]
  ) => Effect.Effect<
    OutputSchema["Type"],
    AppError,
    Collaboration | Idempotency
  >,
  outputSchema: OutputSchema
): Promise<ActionResult<OutputSchema["Type"]>> =>
  runServerAction(
    input,
    schema,
    (validated) =>
      Effect.gen(function* authorizeCommentAction() {
        const requestHeaders = yield* requestHeadersOrFail;
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
      // Comments stay internal unless the author chooses a public reply.
      visibility: Schema.optional(CommentVisibilitySchema),
    }),
    (actorId, validated) =>
      Effect.gen(function* createComment() {
        const collaboration = yield* Collaboration;
        const idempotency = yield* Idempotency;
        const visibility = validated.visibility ?? "internal";
        const commentInput = {
          body: validated.body,
          taskId: validated.taskId,
          visibility,
        };
        return yield* idempotency.run({
          actorId,
          execute: () =>
            collaboration.createComment(
              actorId,
              validated.taskId,
              validated.body,
              visibility
            ),
          input: commentInput,
          key: validated.idempotencyKey,
          operation: "comment.create",
          resultSchema: CreatedCommentSchema,
        });
      }),
    CreatedCommentSchema
  );

  if (result.ok) {
    revalidatePath(`/tasks/${result.data.taskId}`);
    refresh();
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
      }),
    UndoReceiptSchema
  );

  if (result.ok) {
    revalidatePath("/tasks");
    refresh();
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
      }),
    CommentUndoneResultSchema
  );

  if (result.ok) {
    revalidatePath("/tasks");
    refresh();
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
      }),
    CommentReactionResultSchema
  );

  if (result.ok) {
    revalidatePath("/tasks");
    refresh();
  }
  return result;
}
