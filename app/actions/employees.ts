"use server";

import { Effect, Schema } from "effect";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { AppError } from "@/src/server/core/action-result";
import { requireAdmin } from "@/src/server/core/admin-action";
import {
  DoneResultSchema,
  Idempotency,
  IdempotencyLive,
} from "@/src/server/core/idempotency";
import {
  EmailAddressSchema,
  IdempotencyKeySchema,
  UUIDSchema,
} from "@/src/server/core/input-schemas";
import {
  ServerActionOutputSchema,
  runServerAction,
} from "@/src/server/core/server-action";
import {
  CreatedEmployeeSchema,
  CreateEmployeeInputSchema,
  EmployeeDirectorySchema,
  TemporaryPasswordResultSchema,
  UpdateOwnProfileInputSchema,
  UserManagement,
  UserManagementLive,
} from "@/src/server/people/user-management";

const OwnProfileResultSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
});

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function listEmployeesAction(input: unknown) {
  return await runServerAction(
    input,
    Schema.Struct({
      search: Schema.String.check(Schema.isMaxLength(120)),
    }),
    (validated) =>
      Effect.gen(function* listEmployees() {
        const requestHeaders = yield* Effect.tryPromise({
          catch: () =>
            new AppError({
              code: "UNAVAILABLE",
              message: "The request could not be completed.",
            }),
          try: () => headers(),
        });
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(requestHeaders);
        const management = yield* UserManagement;
        return yield* management.listEmployees(actor.id, validated.search);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(UserManagementLive)
      ),
    undefined,
    EmployeeDirectorySchema
  );
}

// oxlint-disable-next-line eslint(func-style) -- Next requires exported Server Actions in this form.
// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function createEmployeeAction(input: unknown) {
  const action = await runServerAction(
    input,
    CreateEmployeeInputSchema,
    (validated) =>
      Effect.gen(function* createEmployee() {
        const requestHeaders = yield* Effect.tryPromise({
          catch: () =>
            new AppError({
              code: "UNAVAILABLE",
              message: "The request could not be completed.",
            }),
          try: () => headers(),
        });
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
    revalidatePath("/settings/people");
  }
  return action;
}

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
        const requestHeaders = yield* Effect.tryPromise({
          catch: () =>
            new AppError({
              code: "UNAVAILABLE",
              message: "The request could not be completed.",
            }),
          try: () => headers(),
        });
        const administrator = yield* requireAdmin(requestHeaders);
        const management = yield* UserManagement;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () =>
            management
              .deactivateEmployee(administrator.id, validated.employeeId)
              .pipe(Effect.map(() => ({ done: true as const }))),
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
    revalidatePath("/settings/people");
  }
  return action;
}

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
        const requestHeaders = yield* Effect.tryPromise({
          catch: () =>
            new AppError({
              code: "UNAVAILABLE",
              message: "The request could not be completed.",
            }),
          try: () => headers(),
        });
        const administrator = yield* requireAdmin(requestHeaders);
        const management = yield* UserManagement;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () =>
            management
              .reactivateEmployee(administrator.id, validated.employeeId)
              .pipe(Effect.map(() => ({ done: true as const }))),
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
    revalidatePath("/settings/people");
  }
  return action;
}

// oxlint-disable-next-line eslint(func-style) -- Next requires exported Server Actions in this form.
// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function changeEmployeeRoleAction(input: unknown) {
  const action = await runServerAction(
    input,
    Schema.Struct({
      employeeId: UUIDSchema,
      idempotencyKey: IdempotencyKeySchema,
      role: Schema.Literals(["admin", "employee"]),
    }),
    (validated) =>
      Effect.gen(function* changeEmployeeRole() {
        const requestHeaders = yield* Effect.tryPromise({
          catch: () =>
            new AppError({
              code: "UNAVAILABLE",
              message: "The request could not be completed.",
            }),
          try: () => headers(),
        });
        const administrator = yield* requireAdmin(requestHeaders);
        const management = yield* UserManagement;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () =>
            management
              .changeEmployeeRole(
                administrator.id,
                validated.employeeId,
                validated.role
              )
              .pipe(Effect.map(() => ({ done: true as const }))),
          input: { employeeId: validated.employeeId, role: validated.role },
          key: validated.idempotencyKey,
          operation: "employee.changeRole",
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
    revalidatePath("/settings/people");
  }
  return action;
}

// Excluded from idempotency: the action returns a one-time temporary password,
// which must never be persisted or replayed.
// oxlint-disable-next-line eslint(func-style) -- Next requires exported Server Actions in this form.
// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function resetEmployeePasswordAction(input: unknown) {
  const action = await runServerAction(
    input,
    Schema.Struct({ employeeId: UUIDSchema }),
    (validated) =>
      Effect.gen(function* resetEmployeePassword() {
        const requestHeaders = yield* Effect.tryPromise({
          catch: () =>
            new AppError({
              code: "UNAVAILABLE",
              message: "The request could not be completed.",
            }),
          try: () => headers(),
        });
        const administrator = yield* requireAdmin(requestHeaders);
        const management = yield* UserManagement;
        return yield* management.resetEmployeePassword(
          administrator.id,
          validated.employeeId
        );
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(UserManagementLive)
      ),
    undefined,
    TemporaryPasswordResultSchema
  );

  if (action.ok) {
    revalidatePath("/settings/people");
  }
  return action;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function updateEmployeeDetailsAction(input: unknown) {
  const action = await runServerAction(
    input,
    Schema.Struct({
      email: EmailAddressSchema,
      employeeId: UUIDSchema,
      idempotencyKey: IdempotencyKeySchema,
      jobTitle: Schema.NullOr(Schema.String),
      teamId: Schema.NullOr(UUIDSchema),
    }),
    (validated) =>
      Effect.gen(function* updateEmployeeDetails() {
        const requestHeaders = yield* Effect.tryPromise({
          catch: () =>
            new AppError({
              code: "UNAVAILABLE",
              message: "The request could not be completed.",
            }),
          try: () => headers(),
        });
        const administrator = yield* requireAdmin(requestHeaders);
        const management = yield* UserManagement;
        const idempotency = yield* Idempotency;
        const details = {
          email: validated.email,
          jobTitle: validated.jobTitle,
          teamId: validated.teamId,
        };
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () =>
            management
              .updateEmployeeDetails(
                administrator.id,
                validated.employeeId,
                details
              )
              .pipe(Effect.map(() => ({ done: true as const }))),
          input: { ...details, employeeId: validated.employeeId },
          key: validated.idempotencyKey,
          operation: "employee.updateDetails",
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
    revalidatePath("/settings/people");
  }
  return action;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function updateOwnProfileAction(input: unknown) {
  const action = await runServerAction(
    input,
    Schema.Struct({
      ...UpdateOwnProfileInputSchema.fields,
      idempotencyKey: IdempotencyKeySchema,
    }),
    (validated) =>
      Effect.gen(function* updateOwnProfile() {
        const requestHeaders = yield* Effect.tryPromise({
          catch: () =>
            new AppError({
              code: "UNAVAILABLE",
              message: "The request could not be completed.",
            }),
          try: () => headers(),
        });
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(requestHeaders);
        const management = yield* UserManagement;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...profileInput } = validated;
        return yield* idempotency.run({
          actorId: actor.id,
          execute: () => management.updateOwnProfile(actor.id, profileInput),
          input: profileInput,
          key: idempotencyKey,
          operation: "profile.update",
          resultSchema: OwnProfileResultSchema,
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
    revalidatePath("/settings/profile");
  }
  return action;
}
