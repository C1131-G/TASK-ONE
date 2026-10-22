import { randomUUID } from "node:crypto";

import { Schema } from "effect";

import { AppError } from "../core/action-result";
import { UUIDSchema } from "../core/input-schemas";
import type { Transaction } from "../work/work-internal";
import type { CustomFieldView } from "./custom-field-contracts";
import { FieldTypeSchema } from "./custom-field-values";
import type { FieldType } from "./custom-field-values";

export const isUuid = Schema.is(UUIDSchema);
const isFieldType = Schema.is(FieldTypeSchema);
const isOptionList = Schema.is(Schema.Array(Schema.String));

export const notFound = (what: string): AppError =>
  new AppError({ code: "NOT_FOUND", message: `The ${what} was not found.` });

export const invalid = (message: string, field?: string): AppError =>
  new AppError({
    code: "VALIDATION_FAILED",
    ...(field ? { field } : {}),
    message,
  });

export const forbidden = (message: string): AppError =>
  new AppError({ code: "FORBIDDEN", message });

export const toActionError = (error: unknown): AppError =>
  error instanceof AppError
    ? error
    : new AppError({
        code: "UNAVAILABLE",
        message: "Custom fields could not be loaded or saved.",
      });

export interface Actor {
  readonly id: string;
  readonly role: string;
}

// Custom fields are internal, so clients and deactivated accounts never get
// past this check, and an account still on its first password is held back.
export const loadStaffActor = async (
  transaction: Pick<Transaction, "orm">,
  actorId: string
): Promise<Actor> => {
  const actor = await transaction.orm.public.User.where({ id: actorId })
    .select("id", "role", "mustChangePassword", "deactivatedAt")
    .first();
  if (!actor || actor.deactivatedAt) {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Sign in to continue.",
    });
  }
  if (actor.mustChangePassword) {
    throw forbidden("Change your password before continuing.");
  }
  if (actor.role === "client") {
    throw forbidden("Custom fields are managed by the team.");
  }
  return actor;
};

export const loadAdminActor = async (
  transaction: Pick<Transaction, "orm">,
  actorId: string
): Promise<Actor> => {
  const actor = await loadStaffActor(transaction, actorId);
  if (actor.role !== "admin") {
    throw forbidden("Administrator access is required.");
  }
  return actor;
};

interface FieldRow {
  readonly id: string;
  readonly name: string;
  readonly options: unknown;
  readonly position: number;
  readonly projectId: string;
  readonly required: boolean;
  readonly type: string;
}

export const fieldTypeOf = (row: FieldRow): FieldType =>
  isFieldType(row.type) ? row.type : "text";

export const optionsOf = (row: FieldRow): readonly string[] =>
  isOptionList(row.options) ? row.options : [];

export const toView = (row: FieldRow): CustomFieldView => ({
  id: row.id,
  name: row.name,
  options: optionsOf(row),
  position: row.position,
  projectId: row.projectId,
  required: row.required,
  type: fieldTypeOf(row),
});

export const recordActivity = (
  transaction: Transaction,
  entry: {
    readonly action: string;
    readonly actorId: string;
    readonly details: Record<string, string | number | boolean | null>;
    readonly projectId: string;
    readonly taskId?: string;
  }
) =>
  transaction.orm.public.Activity.create({
    action: entry.action,
    actorId: entry.actorId,
    createdAt: new Date(),
    details: entry.details,
    id: randomUUID(),
    projectId: entry.projectId,
    taskId: entry.taskId ?? null,
  });
