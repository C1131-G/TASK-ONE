"use server";

import { Effect, Schema } from "effect";
import { refresh, revalidatePath } from "next/cache";

import {
  Approvals,
  ApprovalReceiptSchema,
  RequestApprovalInputSchema,
} from "@/src/server/approvals/approval-contracts";
import { ApprovalsLive } from "@/src/server/approvals/approvals";
import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import {
  DoneResultSchema,
  Idempotency,
  IdempotencyLive,
} from "@/src/server/core/idempotency";
import {
  IdempotencyKeySchema,
  UUIDSchema,
} from "@/src/server/core/input-schemas";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";

const refreshApprovals = () => {
  revalidatePath("/portal/approvals");
  refresh();
};

// Asks a client company to approve a task or milestone with chosen files.
// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function requestApprovalAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      ...RequestApprovalInputSchema.fields,
      idempotencyKey: IdempotencyKeySchema,
    }),
    ({ idempotencyKey, ...request }) =>
      Effect.gen(function* requestApproval() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const approvals = yield* Approvals;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: actor.id,
          execute: () => approvals.request(actor.id, request),
          input: request,
          key: idempotencyKey,
          operation: "approval.request",
          resultSchema: ApprovalReceiptSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(ApprovalsLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    ApprovalReceiptSchema
  );
  if (result.ok) {
    refreshApprovals();
  }
  return result;
}

// Withdraws a request the client has not answered yet.
// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function cancelApprovalAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      idempotencyKey: IdempotencyKeySchema,
      requestId: UUIDSchema,
    }),
    ({ idempotencyKey, requestId }) =>
      Effect.gen(function* cancelApproval() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const approvals = yield* Approvals;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: actor.id,
          execute: () =>
            approvals
              .cancel(actor.id, requestId)
              .pipe(Effect.map(() => ({ done: true as const }))),
          input: { requestId },
          key: idempotencyKey,
          operation: "approval.cancel",
          resultSchema: DoneResultSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(ApprovalsLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    DoneResultSchema
  );
  if (result.ok) {
    refreshApprovals();
  }
  return result;
}
