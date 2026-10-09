import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { StorageApi } from "./storage";
import type { FileCopyResult } from "./uploads-contracts";
import * as internal from "./uploads-internal";

export const requestFileCopy = (
  actorId: string,
  fileId: string
): Effect.Effect<FileCopyResult, AppError> =>
  Effect.tryPromise({
    catch: internal.mapError,
    try: () =>
      db.transaction(async (transaction) => {
        const [actor, source] = await Promise.all([
          internal.getActor(transaction, actorId),
          transaction.orm.public.FileAsset.where({
            deletedAt: null,
            id: fileId,
          }).first(),
        ]);
        if (!source || source.copyState !== "ready") {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The ready file was not found.",
          });
        }
        if (source.taskId) {
          await internal.getEditableTask(transaction, actor, source.taskId);
        } else {
          if (actor.role !== "admin") {
            throw new AppError({
              code: "FORBIDDEN",
              message: "Only admins can duplicate standalone project files.",
            });
          }
          await internal.assertActiveFileLocation(
            transaction,
            actor.role,
            null,
            source.projectId
          );
        }
        const now = new Date();
        const targetFileId = randomUUID();
        const targetKey = `company/files/${source.projectId}/${randomUUID()}`;
        const dot = source.originalName.lastIndexOf(".");
        const fileName =
          dot > 0
            ? `${source.originalName.slice(0, dot)} copy${source.originalName.slice(dot)}`
            : `${source.originalName} copy`;
        const target = await transaction.orm.public.FileAsset.create({
          contentType: source.contentType,
          copyError: null,
          copyState: "pending",
          createdAt: now,
          deletedAt: null,
          deletedById: null,
          id: targetFileId,
          originalName: internal.normalizeFileName(fileName),
          projectId: source.projectId,
          sizeBytes: source.sizeBytes,
          storageKey: targetKey,
          taskId: source.taskId,
          uploadedById: actorId,
        });
        await transaction.orm.public.Job.create({
          availableAt: now,
          createdAt: now,
          dedupeKey: `storage.copy-file:${targetFileId}`,
          id: randomUUID(),
          kind: "storage.copy-file",
          payload: {
            sourceFileId: source.id,
            sourceKey: source.storageKey,
            targetFileId,
            targetKey,
          },
          updatedAt: now,
        });
        await internal.addActivity(
          transaction,
          actorId,
          source.taskId,
          source.projectId,
          "file.duplicate_requested",
          {
            duplicateFileId: targetFileId,
            fileId: source.id,
          }
        );
        return { fileId: target.id, state: "pending" as const };
      }),
  });

export const makeFileCopyOperations = (storage: StorageApi) => {
  const processFileCopy = (
    sourceFileId: string,
    targetFileId: string,
    sourceKey: string,
    targetKey: string
  ): Effect.Effect<void, AppError> =>
    Effect.gen(function* processCopy() {
      const pair = yield* Effect.tryPromise({
        catch: internal.mapError,
        try: async () => {
          const [source, target] = await Promise.all([
            db.orm.public.FileAsset.where({
              deletedAt: null,
              id: sourceFileId,
            }).first(),
            db.orm.public.FileAsset.where({
              deletedAt: null,
              id: targetFileId,
            }).first(),
          ]);
          if (
            !source ||
            !target ||
            target.copyState === "ready" ||
            source.storageKey !== sourceKey ||
            target.storageKey !== targetKey ||
            !sourceKey.startsWith("company/") ||
            !targetKey.startsWith("company/files/")
          ) {
            throw new AppError({
              code: "CONFLICT",
              message: "The file copy request is no longer valid.",
            });
          }
          await db.orm.public.FileAsset.where({ id: targetFileId }).update({
            copyError: null,
            copyState: "pending",
          });
          return target;
        },
      });
      const copied = yield* Effect.result(
        storage.copyObject(sourceKey, targetKey)
      );
      if (copied._tag === "Failure") {
        yield* Effect.tryPromise({
          catch: internal.mapError,
          try: () =>
            db.orm.public.FileAsset.where({ id: targetFileId }).update({
              copyError: "Storage copy failed.",
              copyState: "failed",
            }),
        });
        return yield* Effect.fail(copied.failure);
      }
      yield* Effect.tryPromise({
        catch: internal.mapError,
        try: async () => {
          const updated = await db.orm.public.FileAsset.where({
            copyState: "pending",
            deletedAt: null,
            id: pair.id,
          }).updateAndCount({
            copyError: null,
            copyState: "ready",
          });
          if (!updated) {
            throw new AppError({
              code: "CONFLICT",
              message: "The copied file was removed before completion.",
            });
          }
        },
      });
    });

  return { processFileCopy };
};
