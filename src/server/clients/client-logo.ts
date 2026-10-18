import { randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { addActivity } from "../people/user-internal";
import { Storage } from "../storage/storage";
import type { StorageApi } from "../storage/storage";
import type { UploadTicket } from "../storage/uploads-contracts";
import { activeActor, INTENT_LIFETIME_MS } from "../storage/uploads-internal";
import type { ClientCompanyReceipt } from "./client-company-contracts";
import { bumpCompany, loadCompany } from "./client-company-core";
import { ClientLogos, clientLogoObjectPrefix } from "./client-logo-contracts";
import type {
  FinalizeClientLogoUploadInput,
  RequestClientLogoUploadInput,
} from "./client-logo-contracts";
import {
  logoError,
  invalidLogo,
  logoExtension,
  isLogoContentType,
  isLogoUpload,
  normalizeUpload,
  assertLogoIntent,
  assertPendingIntent,
  retireLogo,
  adminTransaction,
  removeLogo,
} from "./client-logo-support";

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
