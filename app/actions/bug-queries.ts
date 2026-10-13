"use server";

import { Effect, Schema } from "effect";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { UUIDSchema } from "@/src/server/core/input-schemas";
import { runServerAction } from "@/src/server/core/server-action";
import { BugListInputSchema } from "@/src/server/work/bug-contracts";
import {
  BugHistory,
  BugHistoryLive,
  BugHistorySchema,
} from "@/src/server/work/bug-history";
import {
  BugManagement,
  BugManagementLive,
  BugListSchema,
  BugReportItemSchema,
} from "@/src/server/work/bug-management";

import { requestHeadersOrFail } from "./tasks-shared";

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function getBugAction(input: unknown) {
  return await runServerAction(
    input,
    Schema.Struct({ bugId: UUIDSchema }),
    (validated) =>
      Effect.gen(function* getBug() {
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
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function listBugsAction(input: unknown) {
  return await runServerAction(
    input,
    BugListInputSchema,
    (validated) =>
      Effect.gen(function* listBugs() {
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
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function getBugHistoryAction(input: unknown) {
  return await runServerAction(
    input,
    Schema.Struct({ bugId: UUIDSchema }),
    (validated) =>
      Effect.gen(function* getBugHistory() {
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
}
