import { randomBytes, randomUUID } from "node:crypto";

import { and } from "@prisma/orm-postgres/orm-client";
import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { auth } from "../auth/auth";
import { AppError } from "../core/action-result";
import {
  addActivity,
  createCredentialUser,
  databaseError,
  requireAdmin,
  serializeAdminChanges,
  validatePerson,
} from "../people/user-internal";
import type {
  ClientCompanyReceipt,
  ClientCompanyVersionInput,
  CreateClientCompanyInput,
  CreateClientUserInput,
  CreatedClientUser,
  UpdateClientCompanyInput,
} from "./client-company-contracts";
import { bumpCompany, loadCompany, run } from "./client-company-core";

export const createCompany = (
  actorId: string,
  input: CreateClientCompanyInput
): Effect.Effect<ClientCompanyReceipt, AppError> =>
  run(async (transaction) => {
    await requireAdmin(transaction, actorId);
    const now = new Date();
    const id = randomUUID();
    await transaction.orm.public.ClientCompany.create({
      createdAt: now,
      createdById: actorId,
      deactivatedAt: null,
      deactivatedById: null,
      id,
      logoAssetId: null,
      name: input.name,
      updatedAt: now,
      version: 1,
    });
    await addActivity(transaction, actorId, "client_company.created", {
      companyId: id,
      name: input.name,
    });
    return { companyId: id, version: 1 };
  });

export const updateCompany = (
  actorId: string,
  input: UpdateClientCompanyInput
): Effect.Effect<ClientCompanyReceipt, AppError> =>
  run(async (transaction) => {
    await requireAdmin(transaction, actorId);
    const company = await loadCompany(transaction, input.companyId);
    const receipt = await bumpCompany(
      transaction,
      company,
      input.expectedVersion,
      new Date(),
      { name: input.name }
    );
    await addActivity(transaction, actorId, "client_company.updated", {
      companyId: company.id,
      name: input.name,
    });
    return receipt;
  });

export const deactivateCompany = (
  actorId: string,
  input: ClientCompanyVersionInput
): Effect.Effect<ClientCompanyReceipt, AppError> =>
  run(async (transaction) => {
    await requireAdmin(transaction, actorId);
    const company = await loadCompany(transaction, input.companyId);
    if (company.deactivatedAt) {
      throw new AppError({
        code: "CONFLICT",
        message: "The client company is already deactivated.",
      });
    }
    const now = new Date();
    const receipt = await bumpCompany(
      transaction,
      company,
      input.expectedVersion,
      now,
      { deactivatedAt: now, deactivatedById: actorId }
    );
    // The version bump above locks the company before its users change.
    // eslint-disable-next-line react-doctor/server-sequential-independent-await
    const users = await transaction.orm.public.User.where((user) =>
      and(user.clientCompanyId.eq(company.id), user.deactivatedAt.isNull())
    )
      .select("id")
      .all();
    const userIds = users.map(({ id }) => id);
    if (userIds.length > 0) {
      await transaction.orm.public.User.where((user) =>
        user.id.in(userIds)
      ).updateAll({
        deactivatedAt: now,
        deactivatedById: actorId,
        updatedAt: now,
      });
      // Deactivated client users are signed out everywhere at once.
      await transaction.orm.public.Session.where((session) =>
        session.userId.in(userIds)
      ).deleteAll();
    }
    await addActivity(transaction, actorId, "client_company.deactivated", {
      companyId: company.id,
      usersDeactivated: userIds.length,
    });
    return receipt;
  });

export const reactivateCompany = (
  actorId: string,
  input: ClientCompanyVersionInput
): Effect.Effect<ClientCompanyReceipt, AppError> =>
  run(async (transaction) => {
    await requireAdmin(transaction, actorId);
    const company = await loadCompany(transaction, input.companyId);
    if (!company.deactivatedAt) {
      throw new AppError({
        code: "CONFLICT",
        message: "The client company is already active.",
      });
    }
    // Users stay deactivated; an admin reactivates the ones who return.
    const receipt = await bumpCompany(
      transaction,
      company,
      input.expectedVersion,
      new Date(),
      { deactivatedAt: null, deactivatedById: null }
    );
    await addActivity(transaction, actorId, "client_company.reactivated", {
      companyId: company.id,
    });
    return receipt;
  });

export const createClientUser = (
  actorId: string,
  input: CreateClientUserInput
): Effect.Effect<CreatedClientUser, AppError> =>
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
        await requireAdmin(transaction, actorId);
        const company = await loadCompany(transaction, input.companyId);
        if (company.deactivatedAt) {
          throw new AppError({
            code: "CONFLICT",
            message: "Reactivate the client company before adding users.",
          });
        }
        const created = await createCredentialUser(transaction, {
          ...values,
          activityAction: "client_user.created",
          actorId,
          clientCompanyId: company.id,
          passwordHash,
          role: "client",
          teamId: null,
          temporaryPassword,
        });
        return {
          email: created.email,
          id: created.id,
          name: created.name,
          temporaryPassword,
        };
      });
    },
  });
