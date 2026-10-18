import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { DbTransaction } from "../people/user-internal";
import { databaseError, serializeAdminChanges } from "../people/user-internal";
import type { ClientCompanyReceipt } from "./client-company-contracts";

export const companyError = (error: unknown): AppError => {
  if (error instanceof AppError) {
    return error;
  }
  const mapped = databaseError(error);
  return mapped.code === "CONFLICT"
    ? new AppError({
        code: "CONFLICT",
        message: "A client company or account with that name already exists.",
      })
    : new AppError({
        code: "UNAVAILABLE",
        message: "The client company request could not be completed.",
      });
};

export const conflict = (): never => {
  throw new AppError({
    code: "CONFLICT",
    message: "The client company changed. Refresh and try again.",
  });
};

export const loadCompany = async (
  transaction: DbTransaction,
  companyId: string
) => {
  const company = await transaction.orm.public.ClientCompany.where({
    id: companyId,
  }).first();
  if (!company) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "The client company was not found.",
    });
  }
  return company;
};

// Locks the company row by bumping its version; a stale version is a conflict.
export const bumpCompany = async (
  transaction: DbTransaction,
  company: { readonly id: string; readonly version: number },
  expectedVersion: number,
  now: Date,
  changes: Record<string, unknown> = {}
): Promise<ClientCompanyReceipt> => {
  if (company.version !== expectedVersion) {
    conflict();
  }
  const version = company.version + 1;
  const updated = await transaction.orm.public.ClientCompany.where({
    id: company.id,
    version: company.version,
  }).updateAndCount({ ...changes, updatedAt: now, version });
  if (!updated) {
    conflict();
  }
  return { companyId: company.id, version };
};

export const run = <Output>(
  operation: (transaction: DbTransaction) => Promise<Output>
): Effect.Effect<Output, AppError> =>
  Effect.tryPromise({
    catch: companyError,
    try: () =>
      db.transaction(async (transaction) => {
        await serializeAdminChanges(transaction);
        return operation(transaction);
      }),
  });
