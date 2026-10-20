import "server-only";
import { Effect, Schema } from "effect";
import { refresh, revalidatePath, updateTag } from "next/cache";

import { auditEffect } from "@/src/server/audit/audit-log";
import { AuthSessionLive } from "@/src/server/auth/session";
import { requireAdmin } from "@/src/server/core/admin-action";
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
import {
  ServerActionOutputSchema,
  runServerAction,
} from "@/src/server/core/server-action";
import { teamSummariesTag } from "@/src/server/people/team-cache";
import {
  CreatedEmployeeSchema,
  CreateEmployeeInputSchema,
  UserManagement,
  UserManagementLive,
} from "@/src/server/people/user-management";

// oxlint-disable-next-line eslint(func-style) -- Next requires exported Server Actions in this form.
// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.

// oxlint-disable-next-line eslint(func-style) -- Next requires exported Server Actions in this form.
// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function createEmployeeAction(input: unknown) {
  const action = await runServerAction(
    input,
    CreateEmployeeInputSchema,
    (validated) =>
      Effect.gen(function* createEmployee() {
        const requestHeaders = yield* requestHeadersOrFail;
        const administrator = yield* requireAdmin(requestHeaders);
        const management = yield* UserManagement;
        return yield* management.createEmployee(administrator.id, validated);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(UserManagementLive)
      ),
    undefined,
    CreatedEmployeeSchema
  );

  if (action.ok) {
    updateTag(teamSummariesTag);
    revalidatePath("/settings/people");
    refresh();
  }
  return action;
}

// oxlint-disable-next-line eslint(func-style) -- Next requires exported Server Actions in this form.
// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.

// oxlint-disable-next-line eslint(func-style) -- Next requires exported Server Actions in this form.
// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function deactivateEmployeeAction(input: unknown) {
  const action = await runServerAction(
    input,
    Schema.Struct({
      employeeId: UUIDSchema,
      idempotencyKey: IdempotencyKeySchema,
    }),
    (validated) =>
      Effect.gen(function* deactivateEmployee() {
        const requestHeaders = yield* requestHeadersOrFail;
        const administrator = yield* requireAdmin(requestHeaders);
        const management = yield* UserManagement;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () =>
            management
              .deactivateEmployee(administrator.id, validated.employeeId)
              .pipe(
                Effect.tap(() =>
                  auditEffect({
                    actorId: administrator.id,
                    headers: requestHeaders,
                    subjectUserId: validated.employeeId,
                    type: "user_deactivated",
                  })
                ),
                Effect.map(() => ({ done: true as const }))
              ),
          input: { employeeId: validated.employeeId },
          key: validated.idempotencyKey,
          operation: "employee.deactivate",
          resultSchema: DoneResultSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(UserManagementLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    ServerActionOutputSchema
  );

  if (action.ok) {
    updateTag(teamSummariesTag);
    revalidatePath("/settings/people");
    refresh();
  }
  return action;
}

// oxlint-disable-next-line eslint(func-style) -- Next requires exported Server Actions in this form.
// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.

// oxlint-disable-next-line eslint(func-style) -- Next requires exported Server Actions in this form.
// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function reactivateEmployeeAction(input: unknown) {
  const action = await runServerAction(
    input,
    Schema.Struct({
      employeeId: UUIDSchema,
      idempotencyKey: IdempotencyKeySchema,
    }),
    (validated) =>
      Effect.gen(function* reactivateEmployee() {
        const requestHeaders = yield* requestHeadersOrFail;
        const administrator = yield* requireAdmin(requestHeaders);
        const management = yield* UserManagement;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () =>
            management
              .reactivateEmployee(administrator.id, validated.employeeId)
              .pipe(
                Effect.tap(() =>
                  auditEffect({
                    actorId: administrator.id,
                    headers: requestHeaders,
                    subjectUserId: validated.employeeId,
                    type: "user_reactivated",
                  })
                ),
                Effect.map(() => ({ done: true as const }))
              ),
          input: { employeeId: validated.employeeId },
          key: validated.idempotencyKey,
          operation: "employee.reactivate",
          resultSchema: DoneResultSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(UserManagementLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    ServerActionOutputSchema
  );

  if (action.ok) {
    updateTag(teamSummariesTag);
    revalidatePath("/settings/people");
    refresh();
  }
  return action;
}

// oxlint-disable-next-line eslint(func-style) -- Next requires exported Server Actions in this form.
// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
