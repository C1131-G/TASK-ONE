import { randomUUID } from "node:crypto";

import { Effect, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { StorageApi } from "./storage";
import type { FinalizedFile } from "./uploads-contracts";
import * as internal from "./uploads-internal";

export const makeFileReadOperations = (storage: StorageApi) => {
  const finalizeUpload = (
    actorId: string,
    uploadIntentId: string
  ): Effect.Effect<FinalizedFile, AppError> =>
    Effect.gen(function* finalizeTaskUpload() {
      const intent = yield* Effect.tryPromise({
        catch: internal.mapError,
        try: () =>
          db.transaction(async (transaction) => {
            const [actor, found] = await Promise.all([
              internal.getActor(transaction, actorId),
              transaction.orm.public.UploadIntent.where({
                id: uploadIntentId,
              }).first(),
            ]);
            if (!found) {
              throw new AppError({
                code: "NOT_FOUND",
                message: "The upload request was not found.",
              });
            }
            if (found.ownerId !== actorId) {
              throw new AppError({
                code: "FORBIDDEN",
                message: "You cannot finalize this upload.",
              });
            }
            if (found.state === "finalized") {
              return { existing: true as const, record: found };
            }
            if (found.state !== "pending" || found.expiresAt <= new Date()) {
              throw new AppError({
                code: "CONFLICT",
                message:
                  "The upload request has expired or is no longer pending.",
              });
            }
            if (!found.projectId) {
              throw new AppError({
                code: "CONFLICT",
                message: "The upload request is not linked to project work.",
              });
            }
            await internal.assertActiveFileLocation(
              transaction,
              actor.role,
              found.taskId,
              found.projectId
            );
            return { existing: false as const, record: found };
          }),
      });
      if (intent.existing) {
        const file = yield* Effect.tryPromise({
          catch: internal.mapError,
          try: () =>
            db.orm.public.FileAsset.where({
              deletedAt: null,
              storageKey: intent.record.objectKey,
            }).first(),
        });
        if (!file) {
          return yield* Effect.fail(
            new AppError({
              code: "CONFLICT",
              message: "The finalized file record is unavailable.",
            })
          );
        }
        return internal.toFinalizedFile(file);
      }
      yield* storage.verifyObject(
        intent.record.objectKey,
        intent.record.contentType,
        Number(intent.record.sizeBytes)
      );
      return yield* Effect.tryPromise({
        catch: internal.mapError,
        try: () =>
          db.transaction(async (transaction) => {
            const [actor, current] = await Promise.all([
              internal.getActor(transaction, actorId),
              transaction.orm.public.UploadIntent.where({
                id: uploadIntentId,
              }).first(),
            ]);
            if (
              !current ||
              current.state !== "pending" ||
              current.ownerId !== actorId ||
              current.expiresAt <= new Date()
            ) {
              throw new AppError({
                code: "CONFLICT",
                message: "The upload request was already finalized or changed.",
              });
            }
            if (!current.projectId) {
              throw new AppError({
                code: "CONFLICT",
                message: "The upload request is not linked to project work.",
              });
            }
            await internal.assertActiveFileLocation(
              transaction,
              actor.role,
              current.taskId,
              current.projectId
            );
            const now = new Date();
            const claimed = await transaction.orm.public.UploadIntent.where({
              id: current.id,
              state: "pending",
            }).updateAndCount({
              finalizedAt: now,
              state: "finalized",
              updatedAt: now,
            });
            if (!claimed) {
              throw new AppError({
                code: "CONFLICT",
                message: "The upload request was already finalized or changed.",
              });
            }
            const file = await transaction.orm.public.FileAsset.create({
              contentType: current.contentType,
              createdAt: now,
              deletedAt: null,
              deletedById: null,
              id: randomUUID(),
              originalName: current.fileName,
              projectId: current.projectId,
              sizeBytes: current.sizeBytes,
              storageKey: current.objectKey,
              taskId: current.taskId,
              uploadedById: actorId,
            });
            await internal.addActivity(
              transaction,
              actorId,
              current.taskId,
              current.projectId,
              "file.uploaded",
              { fileId: file.id }
            );
            return internal.toFinalizedFile(file);
          }),
      });
    });

  const signedDownload = (
    actorId: string,
    fileId: string
  ): Effect.Effect<string, AppError> =>
    Effect.gen(function* signFileDownload() {
      const file = yield* Effect.tryPromise({
        catch: internal.mapError,
        try: async () => {
          const [actorRole, found] = await Promise.all([
            internal.activeRole(actorId),
            db.orm.public.FileAsset.where({
              deletedAt: null,
              id: fileId,
            }).first(),
          ]);
          if (!found) {
            throw new AppError({
              code: "NOT_FOUND",
              message: "The file was not found.",
            });
          }
          if (found.copyState !== "ready") {
            throw new AppError({
              code: "CONFLICT",
              message: "The file copy is still processing or has failed.",
            });
          }
          if (found.taskId) {
            const task = await db.orm.public.Task.include("project")
              .where({ id: found.taskId })
              .first();
            if (!task) {
              throw new AppError({
                code: "NOT_FOUND",
                message: "The task was not found.",
              });
            }
          } else if (actorRole !== "admin") {
            throw new AppError({
              code: "FORBIDDEN",
              message: "Only admins can access standalone project files.",
            });
          }
          return found;
        },
      });
      return yield* storage.signDownload(file.storageKey, file.originalName);
    });

  // eslint-disable-next-line unicorn/consistent-function-scoping -- Keep file read capabilities together in the upload service layer.
  const signedPreview = (
    actorId: string,
    fileId: string
  ): Effect.Effect<string, AppError> =>
    Effect.gen(function* signFilePreview() {
      const actorRole = yield* Effect.tryPromise({
        catch: internal.mapError,
        try: () => internal.activeRole(actorId),
      });
      const file = yield* Effect.tryPromise({
        catch: internal.mapError,
        try: () =>
          db.orm.public.FileAsset.where({
            deletedAt: null,
            id: fileId,
          }).first(),
      });
      if (!file) {
        return yield* Effect.fail(
          new AppError({
            code: "NOT_FOUND",
            message: "The file was not found.",
          })
        );
      }
      if (file.copyState !== "ready") {
        return yield* Effect.fail(
          new AppError({
            code: "CONFLICT",
            message: "The file copy is still processing or has failed.",
          })
        );
      }
      const { taskId } = file;
      if (taskId) {
        const task = yield* Effect.tryPromise({
          catch: internal.mapError,
          try: () =>
            db.orm.public.Task.where({ id: taskId }).select("id").first(),
        });
        if (!task) {
          return yield* Effect.fail(
            new AppError({
              code: "NOT_FOUND",
              message: "The task was not found.",
            })
          );
        }
      } else if (actorRole !== "admin") {
        return yield* Effect.fail(
          new AppError({
            code: "FORBIDDEN",
            message: "Only admins can access standalone project files.",
          })
        );
      }
      if (!Schema.is(internal.PreviewContentTypeSchema)(file.contentType)) {
        return yield* Effect.fail(
          new AppError({
            code: "FORBIDDEN",
            message: "This file type can only be downloaded as an attachment.",
          })
        );
      }
      return yield* storage.signPreview(file.storageKey, file.contentType);
    });

  // eslint-disable-next-line unicorn/consistent-function-scoping -- Keep upload methods grouped in the Layer constructor.
  return { finalizeUpload, signedDownload, signedPreview };
};
