import { Layer } from "effect";

import { Collaboration } from "./contracts";
import { createComment } from "./create-comment";
import { listComments } from "./list-comments";
import { removeComment } from "./remove-comment";
import { toggleReaction } from "./toggle-reaction";
import { undoCommentRemoval } from "./undo-comment-removal";

export {
  Collaboration,
  CommentListSchema,
  CommentReactionResultSchema,
  CommentUndoneResultSchema,
  CommentViewSchema,
  CreatedCommentSchema,
  UndoReceiptSchema,
} from "./contracts";
export type { CommentView, CreatedComment, UndoReceipt } from "./contracts";

export const CollaborationLive = Layer.succeed(
  Collaboration,
  Collaboration.of({
    createComment,
    listComments,
    removeComment,
    toggleReaction,
    undoCommentRemoval,
  })
);
