import { randomBytes, randomUUID } from "node:crypto";

import { and, or } from "@prisma/orm-postgres/orm-client";
import { Context, Effect, Layer, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { auth } from "../auth/auth";
import { AppError } from "../core/action-result";
import { EmailAddressSchema, UUIDSchema } from "../core/input-schemas";
import { isUniqueConstraintViolation } from "../core/prisma-errors";

export const CreateEmployeeInputSchema = Schema.Struct({
  email: EmailAddressSchema,
  jobTitle: Schema.NullOr(Schema.String),
  name: Schema.String,
  role: Schema.Literals(["employee", "admin"]),
  teamId: Schema.NullOr(UUIDSchema),
});

export type CreateEmployeeInput = typeof CreateEmployeeInputSchema.Type;

export const UpdateOwnProfileInputSchema = Schema.Struct({
  name: Schema.Trim.check(Schema.isMinLength(1), Schema.isMaxLength(120)),
});

export type UpdateOwnProfileInput = typeof UpdateOwnProfileInputSchema.Type;

export interface CreatedEmployee {
  readonly id: string;
  readonly employeeId: string;
  readonly email: string;
  readonly name: string;
  readonly role: CreateEmployeeInput["role"];
  readonly temporaryPassword: string;
}

export interface EmployeeDirectoryEntry {
  readonly id: string;
  readonly employeeId: string;
  readonly name: string;
  readonly email: string;
  readonly role: "admin" | "employee";
  readonly jobTitle: string | null;
  readonly teamId: string | null;
  readonly teamName: string | null;
  readonly avatar: string | null;
}

export interface TemporaryPasswordResult {
  readonly employeeId: string;
  readonly temporaryPassword: string;
}

export const CreatedEmployeeSchema = Schema.Struct({
  email: Schema.String,
  employeeId: Schema.String,
  id: Schema.String,
  name: Schema.String,
  role: Schema.Literals(["employee", "admin"]),
  temporaryPassword: Schema.String,
});

export const EmployeeDirectoryEntrySchema = Schema.Struct({
  avatar: Schema.NullOr(Schema.String),
  email: Schema.String,
  employeeId: Schema.String,
  id: Schema.String,
  jobTitle: Schema.NullOr(Schema.String),
  name: Schema.String,
  role: Schema.Literals(["admin", "employee"]),
  teamId: Schema.NullOr(Schema.String),
  teamName: Schema.NullOr(Schema.String),
});

export const EmployeeDirectorySchema = Schema.Array(
  EmployeeDirectoryEntrySchema
);

export const TemporaryPasswordResultSchema = Schema.Struct({
  employeeId: Schema.String,
  temporaryPassword: Schema.String,
});

export class UserManagement extends Context.Service<
  UserManagement,
  {
    readonly createFirstAdmin: (input: {
      readonly email: string;
      readonly name: string;
    }) => Effect.Effect<CreatedEmployee, AppError>;
    readonly createEmployee: (
      administratorId: string,
      input: CreateEmployeeInput
    ) => Effect.Effect<CreatedEmployee, AppError>;
    readonly updateEmployeeDetails: (
      administratorId: string,
      employeeId: string,
      input: Pick<CreateEmployeeInput, "email" | "jobTitle" | "teamId">
    ) => Effect.Effect<void, AppError>;
    readonly updateOwnProfile: (
      actorId: string,
      input: UpdateOwnProfileInput
    ) => Effect.Effect<
      { readonly id: string; readonly name: string },
      AppError
    >;
    readonly deactivateEmployee: (
      administratorId: string,
      employeeId: string
    ) => Effect.Effect<void, AppError>;
    readonly listEmployees: (
      requesterId: string,
      search: string
    ) => Effect.Effect<readonly EmployeeDirectoryEntry[], AppError>;
    readonly changeEmployeeRole: (
      administratorId: string,
      employeeId: string,
      role: CreateEmployeeInput["role"]
    ) => Effect.Effect<void, AppError>;
    readonly reactivateEmployee: (
      administratorId: string,
      employeeId: string
    ) => Effect.Effect<void, AppError>;
    readonly resetEmployeePassword: (
      administratorId: string,
      employeeId: string
    ) => Effect.Effect<TemporaryPasswordResult, AppError>;
  }
>()("metsys/server/UserManagement") {}

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const validationError = (message: string) =>
  new AppError({ code: "VALIDATION_FAILED", message });

const databaseError = (error: unknown): AppError => {
  if (error instanceof AppError) {
    return error;
  }
  if (isUniqueConstraintViolation(error)) {
    return new AppError({
      code: "CONFLICT",
      message: "An account with that email already exists.",
    });
  }
  return new AppError({
    code: "UNAVAILABLE",
    message: "The account request could not be completed.",
  });
};

const serializeAdminChanges = async (
  transaction: DbTransaction
): Promise<void> => {
  await transaction.orm.public.CompanySettings.upsert({
    conflictOn: { id: "company" },
    create: { id: "company" },
    update: { updatedAt: new Date() },
  });
};

const requireAdmin = async (
  transaction: DbTransaction,
  administratorId: string
) => {
  const administrator = await transaction.orm.public.User.where({
    id: administratorId,
  })
    .select("id", "role", "mustChangePassword", "deactivatedAt")
    .first();
  if (
    !administrator ||
    administrator.role !== "admin" ||
    administrator.deactivatedAt ||
    administrator.mustChangePassword
  ) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "An active admin account is required.",
    });
  }
  return administrator;
};

const addActivity = async (
  transaction: DbTransaction,
  actorId: string,
  action: string,
  details: Record<string, string | number | boolean | null>
): Promise<void> => {
  await transaction.orm.public.Activity.create({
    action,
    actorId,
    createdAt: new Date(),
    details,
    id: randomUUID(),
    projectId: null,
    taskId: null,
  });
};

const validatePerson = (
  emailInput: string,
  nameInput: string,
  jobTitleInput: string | null
) => {
  const name = nameInput.trim();
  const email = emailInput.trim().toLowerCase();
  const jobTitle = jobTitleInput?.trim() || null;
  if (!name || name.length > 160) {
    throw validationError("Enter a name between 1 and 160 characters.");
  }
  if (!Schema.is(EmailAddressSchema)(email)) {
    throw validationError("Enter a valid email address.");
  }
  if (jobTitle && jobTitle.length > 120) {
    throw validationError("Job titles must be 120 characters or fewer.");
  }
  return { email, jobTitle, name };
};

const createCredentialUser = async (
  transaction: DbTransaction,
  values: {
    readonly email: string;
    readonly name: string;
    readonly jobTitle: string | null;
    readonly role: CreateEmployeeInput["role"];
    readonly teamId: string | null;
    readonly temporaryPassword: string;
    readonly passwordHash: string;
    readonly actorId?: string;
    readonly activityAction: string;
  }
): Promise<CreatedEmployee> => {
  const userId = randomUUID();
  const user = await transaction.orm.public.User.create({
    banned: false,
    createdAt: new Date(),
    deactivatedAt: null,
    deactivatedById: null,
    email: values.email,
    emailNormalized: values.email,
    emailVerified: false,
    id: userId,
    image: null,
    jobTitle: values.jobTitle,
    mustChangePassword: true,
    name: values.name,
    role: values.role,
    teamId: values.teamId,
    timeZone: null,
    updatedAt: new Date(),
  });
  await transaction.orm.public.Account.create({
    accountId: userId,
    createdAt: new Date(),
    id: randomUUID(),
    password: values.passwordHash,
    providerId: "credential",
    updatedAt: new Date(),
    userId,
  });
  await addActivity(
    transaction,
    values.actorId ?? userId,
    values.activityAction,
    {
      role: values.role,
      userId,
    }
  );
  return {
    email: values.email,
    employeeId: `EMP${String(user.employeeNumber).padStart(6, "0")}`,
    id: userId,
    name: values.name,
    role: values.role,
    temporaryPassword: values.temporaryPassword,
  };
};

const createEmployee = (
  administratorId: string,
  input: CreateEmployeeInput
): Effect.Effect<CreatedEmployee, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: async () => {
      const values = validatePerson(input.email, input.name, input.jobTitle);
      const temporaryPassword = randomBytes(30).toString("base64url");
      const passwordContext = await auth.$context;
      const passwordHash =
        await passwordContext.password.hash(temporaryPassword);
      return db.transaction(async (transaction) => {
        await serializeAdminChanges(transaction);
        await requireAdmin(transaction, administratorId);
        if (input.teamId) {
          const team = await transaction.orm.public.Team.where({
            id: input.teamId,
          })
            .select("id")
            .first();
          if (!team) {
            throw new AppError({
              code: "NOT_FOUND",
              message: "The selected team does not exist.",
            });
          }
        }
        return createCredentialUser(transaction, {
          ...values,
          activityAction: "user.created",
          actorId: administratorId,
          passwordHash,
          role: input.role,
          teamId: input.teamId,
          temporaryPassword,
        });
      });
    },
  });

const createFirstAdmin = (input: {
  readonly email: string;
  readonly name: string;
}): Effect.Effect<CreatedEmployee, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: async () => {
      const values = validatePerson(input.email, input.name, null);
      const temporaryPassword = randomBytes(30).toString("base64url");
      const passwordContext = await auth.$context;
      const passwordHash =
        await passwordContext.password.hash(temporaryPassword);
      return db.transaction(async (transaction) => {
        await serializeAdminChanges(transaction);
        const existingAdmin = await transaction.orm.public.User.where({
          role: "admin",
        })
          .select("id")
          .first();
        if (existingAdmin) {
          throw new AppError({
            code: "CONFLICT",
            message: "An administrator account already exists.",
          });
        }
        return createCredentialUser(transaction, {
          ...values,
          activityAction: "user.bootstrap_admin_created",
          passwordHash,
          role: "admin",
          teamId: null,
          temporaryPassword,
        });
      });
    },
  });

const deactivateEmployee = (
  administratorId: string,
  employeeId: string
): Effect.Effect<void, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: async () => {
      await db.transaction(async (transaction) => {
        await serializeAdminChanges(transaction);
        await requireAdmin(transaction, administratorId);
        const target = await transaction.orm.public.User.where({
          id: employeeId,
        })
          .select("role", "deactivatedAt")
          .first();
        if (!target) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The account no longer exists.",
          });
        }
        if (target.deactivatedAt) {
          throw new AppError({
            code: "CONFLICT",
            message: "The account is already deactivated.",
          });
        }
        if (target.role === "admin") {
          const activeAdmins = await transaction.orm.public.User.where({
            deactivatedAt: null,
            role: "admin",
          })
            .select("id")
            .all();
          if (activeAdmins.length <= 1) {
            throw new AppError({
              code: "CONFLICT",
              message: "The last active administrator cannot be deactivated.",
            });
          }
        }
        await transaction.orm.public.User.where({ id: employeeId }).update({
          deactivatedAt: new Date(),
          deactivatedById: administratorId,
          updatedAt: new Date(),
        });
        await transaction.orm.public.Session.where({
          userId: employeeId,
        }).deleteAll();
        await addActivity(transaction, administratorId, "user.deactivated", {
          userId: employeeId,
        });
      });
    },
  });

const listEmployees = (
  requesterId: string,
  search: string
): Effect.Effect<readonly EmployeeDirectoryEntry[], AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: async () => {
      const requester = await db.orm.public.User.where({ id: requesterId })
        .select("deactivatedAt", "mustChangePassword")
        .first();
      if (!requester || requester.deactivatedAt) {
        throw new AppError({
          code: "UNAUTHENTICATED",
          message: "Sign in to continue.",
        });
      }
      if (requester.mustChangePassword) {
        throw new AppError({
          code: "FORBIDDEN",
          message: "Change your password before continuing.",
        });
      }
      const normalizedSearch = search.trim().slice(0, 120);
      const users = await db.orm.public.User.include("team")
        .where((user) =>
          normalizedSearch
            ? and(
                user.deactivatedAt.isNull(),
                or(
                  user.name.ilike(`%${normalizedSearch}%`),
                  user.email.ilike(`%${normalizedSearch}%`),
                  user.jobTitle.ilike(`%${normalizedSearch}%`)
                )
              )
            : user.deactivatedAt.isNull()
        )
        .orderBy((user) => user.employeeNumber.asc())
        .limit(500)
        .all();
      return users.map((user) => ({
        avatar: user.image,
        email: user.email,
        employeeId: `EMP${String(user.employeeNumber).padStart(6, "0")}`,
        id: user.id,
        jobTitle: user.jobTitle,
        name: user.name,
        role: Schema.is(Schema.Literals(["admin", "employee"]))(user.role)
          ? user.role
          : "employee",
        teamId: user.teamId,
        teamName: user.team?.name ?? null,
      }));
    },
  });

const updateEmployeeDetails = (
  administratorId: string,
  employeeId: string,
  input: Pick<CreateEmployeeInput, "email" | "jobTitle" | "teamId">
): Effect.Effect<void, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: async () => {
      const values = validatePerson(input.email, "employee", input.jobTitle);
      await db.transaction(async (transaction) => {
        await serializeAdminChanges(transaction);
        await requireAdmin(transaction, administratorId);
        if (input.teamId) {
          const team = await transaction.orm.public.Team.where({
            id: input.teamId,
          })
            .select("id")
            .first();
          if (!team) {
            throw new AppError({
              code: "NOT_FOUND",
              message: "The selected team does not exist.",
            });
          }
        }
        const target = await transaction.orm.public.User.where({
          id: employeeId,
        })
          .select("emailNormalized", "jobTitle", "teamId")
          .first();
        if (!target) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The account no longer exists.",
          });
        }
        const emailChanged = target.emailNormalized !== values.email;
        const jobTitleChanged = target.jobTitle !== values.jobTitle;
        const teamChanged = target.teamId !== input.teamId;
        await transaction.orm.public.User.where({ id: employeeId }).update({
          email: values.email,
          emailNormalized: values.email,
          ...(emailChanged ? { emailVerified: false } : {}),
          jobTitle: values.jobTitle,
          teamId: input.teamId,
          updatedAt: new Date(),
        });
        if (emailChanged) {
          await transaction.orm.public.Session.where({
            userId: employeeId,
          }).deleteAll();
        }
        await addActivity(
          transaction,
          administratorId,
          "user.details_updated",
          {
            emailChanged,
            jobTitleChanged,
            teamChanged,
            userId: employeeId,
          }
        );
      });
    },
  });

const updateOwnProfile = (
  actorId: string,
  rawInput: UpdateOwnProfileInput
): Effect.Effect<{ readonly id: string; readonly name: string }, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: () => {
      let input: UpdateOwnProfileInput;
      try {
        input = Schema.decodeUnknownSync(UpdateOwnProfileInputSchema)(rawInput);
      } catch {
        throw validationError(
          "Enter a display name between 1 and 120 characters."
        );
      }
      return db.transaction(async (transaction) => {
        const actor = await transaction.orm.public.User.where({ id: actorId })
          .select("deactivatedAt", "mustChangePassword")
          .first();
        if (!actor || actor.deactivatedAt) {
          throw new AppError({
            code: "UNAUTHENTICATED",
            message: "Sign in to continue.",
          });
        }
        if (actor.mustChangePassword) {
          throw new AppError({
            code: "FORBIDDEN",
            message: "Change your password before continuing.",
          });
        }
        const updated = await transaction.orm.public.User.where({
          deactivatedAt: null,
          id: actorId,
        }).update({ name: input.name, updatedAt: new Date() });
        if (!updated) {
          throw new AppError({
            code: "UNAUTHENTICATED",
            message: "Sign in to continue.",
          });
        }
        await addActivity(transaction, actorId, "user.profile_updated", {
          name: updated.name,
          userId: actorId,
        });
        return { id: updated.id, name: updated.name };
      });
    },
  });

const changeEmployeeRole = (
  administratorId: string,
  employeeId: string,
  role: CreateEmployeeInput["role"]
): Effect.Effect<void, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: async () => {
      await db.transaction(async (transaction) => {
        await serializeAdminChanges(transaction);
        await requireAdmin(transaction, administratorId);
        const target = await transaction.orm.public.User.where({
          deactivatedAt: null,
          id: employeeId,
        })
          .select("role")
          .first();
        if (!target) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The active account was not found.",
          });
        }
        if (target.role === role) {
          throw new AppError({
            code: "CONFLICT",
            message: "The account already has that role.",
          });
        }
        if (target.role === "admin" && role === "employee") {
          const activeAdmins = await transaction.orm.public.User.where({
            deactivatedAt: null,
            role: "admin",
          })
            .select("id")
            .all();
          if (activeAdmins.length <= 1) {
            throw new AppError({
              code: "CONFLICT",
              message: "The last active administrator cannot be demoted.",
            });
          }
        }
        await transaction.orm.public.User.where({ id: employeeId }).update({
          role,
          updatedAt: new Date(),
        });
        await transaction.orm.public.Session.where({
          userId: employeeId,
        }).deleteAll();
        await addActivity(transaction, administratorId, "user.role_changed", {
          role,
          userId: employeeId,
        });
      });
    },
  });

const reactivateEmployee = (
  administratorId: string,
  employeeId: string
): Effect.Effect<void, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: async () => {
      await db.transaction(async (transaction) => {
        await serializeAdminChanges(transaction);
        await requireAdmin(transaction, administratorId);
        const target = await transaction.orm.public.User.where({
          id: employeeId,
        })
          .select("deactivatedAt")
          .first();
        if (!target) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The account was not found.",
          });
        }
        if (!target.deactivatedAt) {
          throw new AppError({
            code: "CONFLICT",
            message: "The account is already active.",
          });
        }
        await transaction.orm.public.User.where({ id: employeeId }).update({
          deactivatedAt: null,
          deactivatedById: null,
          updatedAt: new Date(),
        });
        await addActivity(transaction, administratorId, "user.reactivated", {
          userId: employeeId,
        });
      });
    },
  });

const resetEmployeePassword = (
  administratorId: string,
  employeeId: string
): Effect.Effect<TemporaryPasswordResult, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: async () => {
      const temporaryPassword = randomBytes(30).toString("base64url");
      const passwordContext = await auth.$context;
      const passwordHash =
        await passwordContext.password.hash(temporaryPassword);
      return db.transaction(async (transaction) => {
        await serializeAdminChanges(transaction);
        await requireAdmin(transaction, administratorId);
        const target = await transaction.orm.public.User.where({
          deactivatedAt: null,
          id: employeeId,
        })
          .select("id")
          .first();
        if (!target) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The active account was not found.",
          });
        }
        const credential = await transaction.orm.public.Account.where({
          providerId: "credential",
          userId: employeeId,
        })
          .select("id")
          .first();
        if (!credential) {
          throw new AppError({
            code: "CONFLICT",
            message: "The credential account is unavailable.",
          });
        }
        await transaction.orm.public.Account.where({
          id: credential.id,
        }).update({
          password: passwordHash,
          updatedAt: new Date(),
        });
        await transaction.orm.public.User.where({ id: employeeId }).update({
          mustChangePassword: true,
          updatedAt: new Date(),
        });
        await transaction.orm.public.Session.where({
          userId: employeeId,
        }).deleteAll();
        await addActivity(transaction, administratorId, "user.password_reset", {
          userId: employeeId,
        });
        return { employeeId, temporaryPassword };
      });
    },
  });

export const UserManagementLive = Layer.succeed(
  UserManagement,
  UserManagement.of({
    changeEmployeeRole,
    createEmployee,
    createFirstAdmin,
    deactivateEmployee,
    listEmployees,
    reactivateEmployee,
    resetEmployeePassword,
    updateEmployeeDetails,
    updateOwnProfile,
  })
);
