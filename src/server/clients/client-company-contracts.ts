import type { Effect } from "effect";
import { Context, Schema } from "effect";

import { clientStatusLabels } from "@/features/portal/client-status";

import type { AppError } from "../core/action-result";
import { EmailAddressSchema, UUIDSchema } from "../core/input-schemas";

const VersionSchema = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThan(0)
);
const CompanyNameSchema = Schema.Trim.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(160)
);

export const CreateClientCompanyInputSchema = Schema.Struct({
  name: CompanyNameSchema,
});

export const UpdateClientCompanyInputSchema = Schema.Struct({
  companyId: UUIDSchema,
  expectedVersion: VersionSchema,
  name: CompanyNameSchema,
});

export const SetClientCompanyProjectsInputSchema = Schema.Struct({
  companyId: UUIDSchema,
  expectedVersion: VersionSchema,
  projectIds: Schema.Array(UUIDSchema).check(Schema.isMaxLength(200)),
});

export const SetClientCompanyHandlersInputSchema = Schema.Struct({
  companyId: UUIDSchema,
  employeeIds: Schema.Array(Schema.String).check(Schema.isMaxLength(100)),
  expectedVersion: VersionSchema,
});

export const ClientCompanyVersionInputSchema = Schema.Struct({
  companyId: UUIDSchema,
  expectedVersion: VersionSchema,
});

export const ClientCompanyIdInputSchema = Schema.Struct({
  companyId: UUIDSchema,
});

export const CreateClientUserInputSchema = Schema.Struct({
  companyId: UUIDSchema,
  email: EmailAddressSchema,
  name: Schema.String,
});

export const ClientUserIdInputSchema = Schema.Struct({
  userId: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200)),
});

export type CreateClientCompanyInput =
  typeof CreateClientCompanyInputSchema.Type;
export type UpdateClientCompanyInput =
  typeof UpdateClientCompanyInputSchema.Type;
export type SetClientCompanyProjectsInput =
  typeof SetClientCompanyProjectsInputSchema.Type;
export type SetClientCompanyHandlersInput =
  typeof SetClientCompanyHandlersInputSchema.Type;
export type ClientCompanyVersionInput =
  typeof ClientCompanyVersionInputSchema.Type;
export type CreateClientUserInput = typeof CreateClientUserInputSchema.Type;

export const ClientCompanySummarySchema = Schema.Struct({
  active: Schema.Boolean,
  handlerCount: Schema.Number,
  id: UUIDSchema,
  name: Schema.String,
  openBugCount: Schema.Number,
  projectCount: Schema.Number,
  userCount: Schema.Number,
  version: VersionSchema,
});

export const ClientCompanySummaryListSchema = Schema.Array(
  ClientCompanySummarySchema
);

export const ClientCompanyUserSchema = Schema.Struct({
  active: Schema.Boolean,
  email: Schema.String,
  id: Schema.String,
  lastActiveAt: Schema.NullOr(Schema.String),
  locked: Schema.Boolean,
  mustChangePassword: Schema.Boolean,
  name: Schema.String,
});

export const ClientCompanyDetailSchema = Schema.Struct({
  bugCounts: Schema.Array(
    Schema.Struct({
      count: Schema.Number,
      label: Schema.Literals(clientStatusLabels),
    })
  ),
  company: ClientCompanySummarySchema,
  handlers: Schema.Array(
    Schema.Struct({
      active: Schema.Boolean,
      email: Schema.String,
      id: Schema.String,
      name: Schema.String,
    })
  ),
  projects: Schema.Array(
    Schema.Struct({
      archived: Schema.Boolean,
      id: UUIDSchema,
      key: Schema.String,
      name: Schema.String,
    })
  ),
  satisfaction: Schema.Struct({ down: Schema.Number, up: Schema.Number }),
  sla: Schema.Struct({
    resolutionBreaches: Schema.Number,
    responseBreaches: Schema.Number,
    tracked: Schema.Number,
  }),
  users: Schema.Array(ClientCompanyUserSchema),
});

export const CreatedClientUserSchema = Schema.Struct({
  email: Schema.String,
  id: Schema.String,
  name: Schema.String,
  temporaryPassword: Schema.String,
});

export const ClientCompanyReceiptSchema = Schema.Struct({
  companyId: UUIDSchema,
  version: VersionSchema,
});

export type ClientCompanySummary = typeof ClientCompanySummarySchema.Type;
export type ClientCompanyDetail = typeof ClientCompanyDetailSchema.Type;
export type CreatedClientUser = typeof CreatedClientUserSchema.Type;
export type ClientCompanyReceipt = typeof ClientCompanyReceiptSchema.Type;

export class ClientCompanyManagement extends Context.Service<
  ClientCompanyManagement,
  {
    readonly listCompanies: (
      actorId: string
    ) => Effect.Effect<readonly ClientCompanySummary[], AppError>;
    readonly getCompany: (
      actorId: string,
      companyId: string
    ) => Effect.Effect<ClientCompanyDetail, AppError>;
    readonly createCompany: (
      actorId: string,
      input: CreateClientCompanyInput
    ) => Effect.Effect<ClientCompanyReceipt, AppError>;
    readonly updateCompany: (
      actorId: string,
      input: UpdateClientCompanyInput
    ) => Effect.Effect<ClientCompanyReceipt, AppError>;
    readonly setProjects: (
      actorId: string,
      input: SetClientCompanyProjectsInput
    ) => Effect.Effect<ClientCompanyReceipt, AppError>;
    readonly setHandlers: (
      actorId: string,
      input: SetClientCompanyHandlersInput
    ) => Effect.Effect<ClientCompanyReceipt, AppError>;
    readonly deactivateCompany: (
      actorId: string,
      input: ClientCompanyVersionInput
    ) => Effect.Effect<ClientCompanyReceipt, AppError>;
    readonly reactivateCompany: (
      actorId: string,
      input: ClientCompanyVersionInput
    ) => Effect.Effect<ClientCompanyReceipt, AppError>;
    readonly createClientUser: (
      actorId: string,
      input: CreateClientUserInput
    ) => Effect.Effect<CreatedClientUser, AppError>;
  }
>()("metsys/server/ClientCompanyManagement") {}
