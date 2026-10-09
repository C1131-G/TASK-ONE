import type { Effect } from "effect";
import { Context, Schema } from "effect";

import type { AppError } from "../core/action-result";
import { EmailAddressSchema, UUIDSchema } from "../core/input-schemas";

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
