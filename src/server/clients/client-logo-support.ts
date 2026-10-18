import { randomUUID } from "node:crypto";

import { Effect, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { DbTransaction } from "../people/user-internal";
import {
  addActivity,
  requireAdmin,
  serializeAdminChanges,
} from "../people/user-internal";
import type { ClientCompanyReceipt } from "./client-company-contracts";
import { bumpCompany, loadCompany } from "./client-company-core";
import {
  ClientLogoContentTypeSchema,
  ClientLogoUploadSchema,
  MAX_CLIENT_LOGO_BYTES,
  clientLogoObjectPrefix,
} from "./client-logo-contracts";
import type {
  RemoveClientLogoInput,
  RequestClientLogoUploadInput,
} from "./client-logo-contracts";

export const DELETE_CLIENT_LOGO_JOB = "storage.delete-client-logo";

export const logoError = (error: unknown): AppError =>
  error instanceof AppError
    ? error
    : new AppError({
        code: "UNAVAILABLE",
        message: "The client logo request could not be completed.",
      });

export const invalidLogo = () =>
  new AppError({
    code: "VALIDATION_FAILED",
    message: "Logos must be PNG, JPEG, or WebP images up to 2 MB.",
  });

export const changedRequest = () =>
  new AppError({
    code: "CONFLICT",
    message: "The logo upload request expired or changed.",
  });

export const logoExtension = (contentType: string): string =>
  contentType === "image/jpeg" ? "jpg" : contentType.slice("image/".length);

export const isLogoContentType = Schema.is(ClientLogoContentTypeSchema);
export const isLogoUpload = Schema.is(ClientLogoUploadSchema);

export const normalizeUpload = (input: RequestClientLogoUploadInput) => ({
  contentType: input.contentType.trim().toLowerCase(),
  sizeBytes: input.sizeBytes,
});

export interface LogoIntent {
  readonly contentType: string;
  readonly expiresAt: Date;
  readonly objectKey: string;
  readonly ownerId: string;
  readonly projectId: string | null;
  readonly sizeBytes: bigint;
  readonly state: string;
  readonly taskId: string | null;
}

// A logo intent belongs to the admin who asked for it and to one company,
// and must still have the shape a logo is allowed to have.
export const assertLogoIntent = (
  intent: LogoIntent | null | undefined,
  actorId: string,
  companyId: string
): LogoIntent => {
  if (!intent || intent.ownerId !== actorId) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "The logo upload request was not found.",
    });
  }
  if (
    !intent.objectKey.startsWith(clientLogoObjectPrefix(companyId)) ||
    intent.taskId ||
    intent.projectId ||
    !isLogoContentType(intent.contentType) ||
    intent.sizeBytes > BigInt(MAX_CLIENT_LOGO_BYTES)
  ) {
    throw changedRequest();
  }
  return intent;
};

export const assertPendingIntent = (intent: LogoIntent): void => {
  if (intent.state !== "pending" || intent.expiresAt <= new Date()) {
    throw changedRequest();
  }
};

// Marks the logo being replaced as removed and queues its object for deletion.
export const retireLogo = async (
  transaction: DbTransaction,
  companyId: string,
  intentId: string,
  now: Date
): Promise<void> => {
  const previous = await transaction.orm.public.UploadIntent.where({
    id: intentId,
  })
    .select("objectKey")
    .first();
  if (!previous?.objectKey.startsWith(clientLogoObjectPrefix(companyId))) {
    return;
  }
  const retired = await transaction.orm.public.UploadIntent.where({
    id: intentId,
    state: "finalized",
  }).updateAndCount({ removedAt: now, state: "removed", updatedAt: now });
  if (!retired) {
    return;
  }
  await transaction.orm.public.Job.create({
    availableAt: now,
    createdAt: now,
    dedupeKey: `${DELETE_CLIENT_LOGO_JOB}:${previous.objectKey}`,
    id: randomUUID(),
    kind: DELETE_CLIENT_LOGO_JOB,
    maxAttempts: 8,
    payload: { objectKey: previous.objectKey },
    updatedAt: now,
  });
};

export const adminTransaction = <Output>(
  actorId: string,
  operation: (transaction: DbTransaction) => Promise<Output>
): Effect.Effect<Output, AppError> =>
  Effect.tryPromise({
    catch: logoError,
    try: () =>
      db.transaction(async (transaction) => {
        await serializeAdminChanges(transaction);
        await requireAdmin(transaction, actorId);
        return operation(transaction);
      }),
  });

export const removeLogo = (
  actorId: string,
  input: RemoveClientLogoInput
): Effect.Effect<ClientCompanyReceipt, AppError> =>
  adminTransaction(actorId, async (transaction) => {
    const company = await loadCompany(transaction, input.companyId);
    const previous = company.logoAssetId;
    if (company.version === input.expectedVersion && !previous) {
      throw new AppError({
        code: "CONFLICT",
        message: "The client company has no logo to remove.",
      });
    }
    const now = new Date();
    const receipt = await bumpCompany(
      transaction,
      company,
      input.expectedVersion,
      now,
      { logoAssetId: null }
    );
    if (previous) {
      await retireLogo(transaction, company.id, previous, now);
    }
    await addActivity(transaction, actorId, "client_company.logo_removed", {
      companyId: company.id,
    });
    return receipt;
  });
