import { randomUUID } from "node:crypto";

import { Effect, Layer, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { DbTransaction } from "../people/user-internal";
import {
  addActivity,
  requireAdmin,
  serializeAdminChanges,
} from "../people/user-internal";
import { Storage } from "../storage/storage";
import type { StorageApi } from "../storage/storage";
import type { UploadTicket } from "../storage/uploads-contracts";
import { activeActor, INTENT_LIFETIME_MS } from "../storage/uploads-internal";
import type { ClientCompanyReceipt } from "./client-company-contracts";
import { bumpCompany, loadCompany } from "./client-company-management";
import {
  ClientLogoContentTypeSchema,
  ClientLogoUploadSchema,
  ClientLogos,
  MAX_CLIENT_LOGO_BYTES,
  clientLogoObjectPrefix,
} from "./client-logo-contracts";
import type {
  FinalizeClientLogoUploadInput,
  RemoveClientLogoInput,
  RequestClientLogoUploadInput,
} from "./client-logo-contracts";

export const DELETE_CLIENT_LOGO_JOB = "storage.delete-client-logo";

const logoError = (error: unknown): AppError =>
  error instanceof AppError
    ? error
    : new AppError({
        code: "UNAVAILABLE",
        message: "The client logo request could not be completed.",
      });

const invalidLogo = () =>
  new AppError({
    code: "VALIDATION_FAILED",
    message: "Logos must be PNG, JPEG, or WebP images up to 2 MB.",
  });

const changedRequest = () =>
  new AppError({
    code: "CONFLICT",
    message: "The logo upload request expired or changed.",
  });

const logoExtension = (contentType: string): string =>
  contentType === "image/jpeg" ? "jpg" : contentType.slice("image/".length);

const isLogoContentType = Schema.is(ClientLogoContentTypeSchema);
const isLogoUpload = Schema.is(ClientLogoUploadSchema);

const normalizeUpload = (input: RequestClientLogoUploadInput) => ({
  contentType: input.contentType.trim().toLowerCase(),
  sizeBytes: input.sizeBytes,
});

interface LogoIntent {
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
const assertLogoIntent = (
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

const assertPendingIntent = (intent: LogoIntent): void => {
  if (intent.state !== "pending" || intent.expiresAt <= new Date()) {
    throw changedRequest();
  }
};

// Marks the logo being replaced as removed and queues its object for deletion.
const retireLogo = async (
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

const adminTransaction = <Output>(
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

const removeLogo = (
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

export const makeClientLogos = (storage: StorageApi) => {
  const requestLogoUpload = (
    actorId: string,
    input: RequestClientLogoUploadInput
  ): Effect.Effect<UploadTicket, AppError> =>
    Effect.gen(function* requestClientLogoUpload() {
      const intent = yield* adminTransaction(actorId, async (transaction) => {
        // Checked after the admin check so a non-admin learns nothing more.
        const upload = normalizeUpload(input);
        if (!isLogoUpload(upload)) {
          throw invalidLogo();
        }
        const company = await loadCompany(transaction, input.companyId);
        const id = randomUUID();
        const objectKey = `${clientLogoObjectPrefix(company.id)}${randomUUID()}`;
        const now = new Date();
        await transaction.orm.public.UploadIntent.create({
          contentType: upload.contentType,
          createdAt: now,
          expiresAt: new Date(now.getTime() + INTENT_LIFETIME_MS),
          fileName: `logo.${logoExtension(upload.contentType)}`,
          finalizedAt: null,
          id,
          objectKey,
          ownerId: actorId,
          projectId: null,
          removedAt: null,
          sizeBytes: BigInt(upload.sizeBytes),
          state: "pending",
          taskId: null,
          updatedAt: now,
        });
        return { contentType: upload.contentType, id, objectKey };
      });
      const uploadUrl = yield* storage.signUpload(
        intent.objectKey,
        intent.contentType,
        input.sizeBytes
      );
      return {
        requiredHeaders: {
          "content-type": intent.contentType,
          "if-none-match": "*" as const,
        },
        uploadIntentId: intent.id,
        uploadUrl,
      };
    });

  const finalizeLogoUpload = (
    actorId: string,
    input: FinalizeClientLogoUploadInput
  ): Effect.Effect<ClientCompanyReceipt, AppError> =>
    Effect.gen(function* finalizeClientLogoUpload() {
      const found = yield* adminTransaction(actorId, async (transaction) => {
        const intent = assertLogoIntent(
          await transaction.orm.public.UploadIntent.where({
            id: input.uploadIntentId,
          }).first(),
          actorId,
          input.companyId
        );
        assertPendingIntent(intent);
        return intent;
      });
      // The object must be in storage, with the declared type and size,
      // before the company points at it.
      yield* storage.verifyObject(
        found.objectKey,
        found.contentType,
        Number(found.sizeBytes)
      );
      return yield* adminTransaction(actorId, async (transaction) => {
        const intent = assertLogoIntent(
          await transaction.orm.public.UploadIntent.where({
            id: input.uploadIntentId,
          }).first(),
          actorId,
          input.companyId
        );
        assertPendingIntent(intent);
        const company = await loadCompany(transaction, input.companyId);
        const now = new Date();
        const receipt = await bumpCompany(
          transaction,
          company,
          input.expectedVersion,
          now,
          { logoAssetId: input.uploadIntentId }
        );
        // The version bump above locks the company before the intent is claimed.
        // eslint-disable-next-line react-doctor/server-sequential-independent-await
        const claimed = await transaction.orm.public.UploadIntent.where({
          id: input.uploadIntentId,
          state: "pending",
        }).updateAndCount({
          finalizedAt: now,
          state: "finalized",
          updatedAt: now,
        });
        if (!claimed) {
          throw new AppError({
            code: "CONFLICT",
            message: "The logo upload request was already finalized.",
          });
        }
        if (
          company.logoAssetId &&
          company.logoAssetId !== input.uploadIntentId
        ) {
          await retireLogo(transaction, company.id, company.logoAssetId, now);
        }
        await addActivity(transaction, actorId, "client_company.logo_set", {
          companyId: company.id,
          replaced: company.logoAssetId !== null,
        });
        return receipt;
      });
    });

  const signedLogo = (
    viewerId: string,
    companyId: string
  ): Effect.Effect<string | null, AppError> =>
    Effect.gen(function* signClientLogo() {
      const logo = yield* Effect.tryPromise({
        catch: logoError,
        try: async () => {
          const [viewer, company] = await Promise.all([
            activeActor(viewerId),
            db.orm.public.ClientCompany.where({ id: companyId })
              .select("logoAssetId")
              .first(),
          ]);
          const allowed =
            viewer.role === "admin" ||
            (viewer.role === "client" && viewer.clientCompanyId === companyId);
          if (!allowed) {
            throw new AppError({
              code: "FORBIDDEN",
              message: "This logo is not available to you.",
            });
          }
          if (!company?.logoAssetId) {
            return null;
          }
          const intent = await db.orm.public.UploadIntent.where({
            id: company.logoAssetId,
            state: "finalized",
          })
            .select("contentType", "objectKey")
            .first();
          if (
            !intent?.objectKey.startsWith(clientLogoObjectPrefix(companyId)) ||
            !isLogoContentType(intent.contentType)
          ) {
            return null;
          }
          return intent;
        },
      });
      if (!logo) {
        return null;
      }
      return yield* storage.signPreview(logo.objectKey, logo.contentType);
    });

  return ClientLogos.of({
    finalizeLogoUpload,
    removeLogo,
    requestLogoUpload,
    signedLogo,
  });
};

export const ClientLogosLive = Layer.effect(
  ClientLogos,
  Effect.map(Effect.service(Storage), makeClientLogos)
);
