import "server-only";
import { Effect, Schema } from "effect";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import {
  TeamWorkload,
  TeamWorkloadLive,
} from "@/src/server/workload/team-workload";
import { WorkloadViewSchema } from "@/src/server/workload/workload-contracts";

// Staff see every teammate's upcoming load; clients never reach it.
export const getWorkload = async (input: unknown) =>
  await runServerAction(
    input,
    Schema.Struct({}),
    () =>
      Effect.gen(function* workloadProgram() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const workload = yield* TeamWorkload;
        return yield* workload.view(actor.id, new Date());
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(TeamWorkloadLive)
      ),
    undefined,
    WorkloadViewSchema
  );
