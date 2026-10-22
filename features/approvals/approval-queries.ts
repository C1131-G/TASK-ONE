import "server-only";
import { Effect, Schema } from "effect";

import {
  Approvals,
  TaskApprovalsSchema,
} from "@/src/server/approvals/approval-contracts";
import { ApprovalsLive } from "@/src/server/approvals/approvals";
import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { UUIDSchema } from "@/src/server/core/input-schemas";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";

// Staff only: the approvals requested for one task, newest version first.
export const listTaskApprovals = async (input: unknown) =>
  await runServerAction(
    input,
    Schema.Struct({ taskId: UUIDSchema }),
    ({ taskId }) =>
      Effect.gen(function* taskApprovals() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const approvals = yield* Approvals;
        return yield* approvals.forTask(actor.id, taskId);
      }).pipe(Effect.provide(AuthSessionLive), Effect.provide(ApprovalsLive)),
    undefined,
    TaskApprovalsSchema
  );
