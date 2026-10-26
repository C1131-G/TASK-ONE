import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import type { CommentVisibility } from "../collaboration/contracts";
import { createComment } from "../collaboration/create-comment";
import { AppError } from "../core/action-result";
import { databaseError } from "./work-internal";

export interface BugCommentInput {
  readonly body: string;
  readonly bugId: string;
  readonly visibility: CommentVisibility;
}

// A bug's discussion is its task's comments. The comment service owns the
// rules (client-visible replies, the handler restriction, mentions); this only
// finds the task the bug lives on.
export const addBugComment = (actorId: string, input: BugCommentInput) =>
  Effect.gen(function* addComment() {
    const bug = yield* Effect.tryPromise({
      catch: databaseError,
      try: () =>
        db.orm.public.BugReport.where({ id: input.bugId })
          .select("id", "taskId")
          .first(),
    });
    if (!bug) {
      return yield* Effect.fail(
        new AppError({
          code: "NOT_FOUND",
          message: "The bug report was not found.",
        })
      );
    }
    const comment = yield* createComment(
      actorId,
      bug.taskId,
      input.body,
      input.visibility
    );
    return {
      authorId: comment.authorId,
      body: comment.body,
      bugId: bug.id,
      createdAt: comment.createdAt,
      id: comment.id,
      visibility: comment.visibility,
    };
  });
