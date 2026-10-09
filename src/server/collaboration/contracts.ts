import type { Effect } from "effect";
import { Context, Schema } from "effect";

import type { AppError } from "../core/action-result";

export interface CreatedComment {
  readonly id: string;
  readonly taskId: string;
  readonly authorId: string;
  readonly body: string;
  readonly createdAt: string;
}

export interface CommentView extends CreatedComment {
  readonly authorName: string;
  readonly reactions: readonly {
    readonly emoji: string;
    readonly count: number;
    readonly reacted: boolean;
  }[];
}

export interface UndoReceipt {
  readonly expiresAt: string;
  readonly undoId: string;
}

export const CreatedCommentSchema = Schema.Struct({
  authorId: Schema.String,
  body: Schema.String,
  createdAt: Schema.String,
  id: Schema.String,
  taskId: Schema.String,
});

export const CommentViewSchema = Schema.Struct({
  ...CreatedCommentSchema.fields,
  authorName: Schema.String,
  reactions: Schema.Array(
    Schema.Struct({
      count: Schema.Number,
      emoji: Schema.String,
      reacted: Schema.Boolean,
    })
  ),
});
export const CommentListSchema = Schema.Array(CommentViewSchema);

export const UndoReceiptSchema = Schema.Struct({
  expiresAt: Schema.String,
  undoId: Schema.String,
});

export const CommentReactionResultSchema = Schema.Struct({
  active: Schema.Boolean,
});

export const CommentUndoneResultSchema = Schema.Struct({
  undone: Schema.Literal(true),
});

export class Collaboration extends Context.Service<
  Collaboration,
  {
    readonly listComments: (
      actorId: string,
      taskId: string
    ) => Effect.Effect<readonly CommentView[], AppError>;
    readonly createComment: (
      actorId: string,
      taskId: string,
      body: string
    ) => Effect.Effect<CreatedComment, AppError>;
    readonly removeComment: (
      actorId: string,
      commentId: string
    ) => Effect.Effect<UndoReceipt, AppError>;
    readonly undoCommentRemoval: (
      actorId: string,
      undoId: string
    ) => Effect.Effect<void, AppError>;
    readonly toggleReaction: (
      actorId: string,
      commentId: string,
      emoji: string
    ) => Effect.Effect<{ readonly active: boolean }, AppError>;
  }
>()("metsys/server/Collaboration") {}
