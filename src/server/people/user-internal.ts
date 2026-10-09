import { randomUUID } from "node:crypto";

import { Schema } from "effect";

import type { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { EmailAddressSchema } from "../core/input-schemas";
import { isUniqueConstraintViolation } from "../core/prisma-errors";
import type { CreateEmployeeInput, CreatedEmployee } from "./user-contracts";

export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const validationError = (message: string) =>
  new AppError({ code: "VALIDATION_FAILED", message });

export const databaseError = (error: unknown): AppError => {
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

export const serializeAdminChanges = async (
  transaction: DbTransaction
): Promise<void> => {
  await transaction.orm.public.CompanySettings.upsert({
    conflictOn: { id: "company" },
    create: { id: "company" },
    update: { updatedAt: new Date() },
  });
};

export const requireAdmin = async (
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

export const addActivity = async (
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

export const validatePerson = (
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

export const createCredentialUser = async (
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
