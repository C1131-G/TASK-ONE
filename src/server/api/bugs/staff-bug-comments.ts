import { Effect } from "effect";

import {
  StaffBugComment,
  staffBugCommentRoute,
} from "../../../mobile-api/routes-bugs";
import { Idempotency } from "../../core/idempotency";
import { addBugComment } from "../../work/bug-staff-comments";
import { asStaffCaller } from "./caller";
import type { PathParams } from "./caller";

// A staff reply in a bug's discussion. The author is the caller; the comment
// service decides who may write and what each visibility means.
export const addWorkspaceBugComment = (request: Request, params: PathParams) =>
  asStaffCaller(staffBugCommentRoute, request, params, ({ input, user }) =>
    Effect.gen(function* comment() {
      const idempotency = yield* Idempotency;
      const commentInput = { ...input.body, bugId: input.params.bugId };
      return yield* idempotency.run({
        actorId: user.id,
        execute: () => addBugComment(user.id, commentInput),
        input: commentInput,
        key: input.idempotencyKey,
        operation: "bug.comment.add",
        resultSchema: StaffBugComment,
      });
    })
  );
