import "server-only";
import { Effect, Schema } from "effect";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { UUIDSchema } from "@/src/server/core/input-schemas";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import { BugListInputSchema } from "@/src/server/work/bug-contracts";
import {
  BugHistory,
  BugHistoryLive,
  BugHistorySchema,
} from "@/src/server/work/bug-history";
import {
  BugListSchema,
  BugManagement,
  BugManagementLive,
  BugReportItemSchema,
} from "@/src/server/work/bug-management";

export const getBug = async (input: unknown) =>
  await runServerAction(
    input,
    Schema.Struct({ bugId: UUIDSchema }),
    (validated) =>
      Effect.gen(function* getBugProgram() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const bugs = yield* BugManagement;
        return yield* bugs.getBug(actor.id, validated.bugId);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(BugManagementLive)
      ),
    undefined,
    BugReportItemSchema
  );

export const listBugs = async (input: unknown) =>
  await runServerAction(
    input,
    BugListInputSchema,
    (validated) =>
      Effect.gen(function* listBugsProgram() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const bugs = yield* BugManagement;
        return yield* bugs.listBugs(actor.id, validated);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(BugManagementLive)
      ),
    undefined,
    BugListSchema
  );

export const getBugHistory = async (input: unknown) =>
  await runServerAction(
    input,
    Schema.Struct({ bugId: UUIDSchema }),
    (validated) =>
      Effect.gen(function* getBugHistoryProgram() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const history = yield* BugHistory;
        return yield* history.get(actor.id, validated.bugId);
      }).pipe(Effect.provide(AuthSessionLive), Effect.provide(BugHistoryLive)),
    undefined,
    BugHistorySchema
  );
