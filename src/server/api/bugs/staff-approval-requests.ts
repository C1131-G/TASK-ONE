import { Effect } from "effect";

import { workspaceApprovalRoute } from "../../../mobile-api/routes-bugs";
import {
  ApprovalReceiptSchema,
  Approvals,
} from "../../approvals/approval-contracts";
import { Idempotency } from "../../core/idempotency";
import { asStaffCaller } from "./caller";

// A staff member asks a client company to approve a task with its files. The
// domain service keeps the same rules the web action has; the write is made
// safe to retry with the same key the web action uses.
export const requestWorkspaceApproval = (request: Request) =>
  asStaffCaller(workspaceApprovalRoute, request, {}, ({ input, user }) =>
    Effect.gen(function* requestApproval() {
      const approvals = yield* Approvals;
      const idempotency = yield* Idempotency;
      const { body, idempotencyKey } = input;
      return yield* idempotency.run({
        actorId: user.id,
        execute: () => approvals.request(user.id, body),
        input: body,
        key: idempotencyKey,
        operation: "approval.request",
        resultSchema: ApprovalReceiptSchema,
      });
    })
  );
