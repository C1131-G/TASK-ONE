import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { FinalizedFile, UndoReceipt } from "./uploads-contracts";
import * as internal from "./uploads-internal";

export const renameFile = (
  actorId: string,
  fileId: string,
  rawFileName: string
): Effect.Effect<FinalizedFile, AppError> =>
  Effect.tryPromise({
    catch: internal.mapError,
    try: () =>
      db.transaction(async (transaction) => {
        const [actor, file] = await Promise.all([
          internal.getActor(transaction, actorId),
          transaction.orm.public.FileAsset.where({ id: fileId }).first(),
        ]);
        if (!file || file.deletedAt) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The active file was not found.",
          });
        }
        if (file.taskId) {
          await internal.getEditableTask(transaction, actor, file.taskId);
        } else if (actor.role !== "admin") {
          throw new AppError({
            code: "FORBIDDEN",
            message: "Only admins can manage standalone project files.",
          });
        }
        const fileName = internal.normalizeFileName(rawFileName);
        const renamed = await transaction.orm.public.FileAsset.where({
          deletedAt: null,
          id: fileId,
        }).updateAndCount({ originalName: fileName });
        if (!renamed) {
          throw new AppError({
            code: "CONFLICT",
            message: "The file changed before it could be renamed.",
          });
        }
        const updated = await transaction.orm.public.FileAsset.where({
          id: fileId,
        }).first();
        if (!updated) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The file was not found.",
          });
        }
        await internal.addActivity(
          transaction,
          actorId,
          file.taskId,
          file.projectId,
          "file.renamed",
          { fileId, name: fileName }
        );
        return internal.toFinalizedFile(updated);
      }),
  });

// eslint-disable-next-line unicorn/consistent-function-scoping -- Keep upload methods grouped in the Layer constructor.
export const removeFile = (
  actorId: string,
  fileId: string
): Effect.Effect<UndoReceipt, AppError> =>
  Effect.tryPromise({
    catch: internal.mapError,
    try: () =>
      db.transaction(async (transaction) => {
        const [actor, file] = await Promise.all([
          internal.getActor(transaction, actorId),
          transaction.orm.public.FileAsset.where({ id: fileId }).first(),
        ]);
        if (!file) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The file was not found.",
          });
        }
        if (file.deletedAt) {
          throw new AppError({
            code: "CONFLICT",
            message: "The file was already removed.",
          });
        }
        if (actor.role !== "admin" && file.uploadedById !== actorId) {
          throw new AppError({
            code: "FORBIDDEN",
            message: "You can remove only your own uploads.",
          });
        }
        await internal.assertActiveFileLocation(
          transaction,
          actor.role,
          file.taskId,
          file.projectId
        );
        const now = new Date();
        const updated = await transaction.orm.public.FileAsset.where({
          deletedAt: null,
          id: fileId,
        }).updateAndCount({ deletedAt: now, deletedById: actorId });
        if (!updated) {
          throw new AppError({
            code: "CONFLICT",
            message: "The file changed before it could be removed.",
          });
        }
        const undoId = randomUUID();
        const expiresAt = new Date(now.getTime() + internal.UNDO_LIFETIME_MS);
        await transaction.orm.public.UndoRecord.create({
          action: "file.remove",
          actorId,
          consumedAt: null,
          createdAt: now,
          entityId: fileId,
          entityType: "file",
          expiresAt,
          id: undoId,
          snapshot: { fileId },
        });
        await internal.addActivity(
          transaction,
          actorId,
          file.taskId,
          file.projectId,
          "file.removed",
          { fileId }
        );
        return { expiresAt: expiresAt.toISOString(), undoId };
      }),
  });

// eslint-disable-next-line unicorn/consistent-function-scoping -- Keep upload methods grouped in the Layer constructor.
export const undoFileRemoval = (
  actorId: string,
  undoId: string
): Effect.Effect<void, AppError> =>
  Effect.tryPromise({
    catch: internal.mapError,
    try: () =>
      db.transaction(async (transaction) => {
        const [actor, undo] = await Promise.all([
          internal.getActor(transaction, actorId),
          transaction.orm.public.UndoRecord.where({ id: undoId }).first(),
        ]);
        if (!undo) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The undo request was not found.",
          });
        }
        if (undo.actorId !== actorId) {
          throw new AppError({
            code: "FORBIDDEN",
            message: "This undo request belongs to another user.",
          });
        }
        if (undo.action !== "file.remove" || undo.entityType !== "file") {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The undo request was not found.",
          });
        }
        if (undo.consumedAt || undo.expiresAt <= new Date()) {
          throw new AppError({
            code: "CONFLICT",
            message: "This undo request has expired or was already used.",
          });
        }
        const file = await transaction.orm.public.FileAsset.where({
          id: undo.entityId,
        }).first();
        if (!file) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The file was not found.",
          });
        }
        if (!file.deletedAt || file.deletedById !== actorId) {
          throw new AppError({
            code: "CONFLICT",
            message: "The file changed after it was removed.",
          });
        }
        await internal.assertActiveFileLocation(
          transaction,
          actor.role,
          file.taskId,
          file.projectId
        );
        const now = new Date();
        const restored = await transaction.orm.public.FileAsset.where({
          deletedById: actorId,
          id: file.id,
        }).updateAndCount({ deletedAt: null, deletedById: null });
        if (!restored) {
          throw new AppError({
            code: "CONFLICT",
            message: "The file changed after it was removed.",
          });
        }
        const consumed = await transaction.orm.public.UndoRecord.where({
          consumedAt: null,
          id: undoId,
        }).updateAndCount({ consumedAt: now });
        if (!consumed) {
          throw new AppError({
            code: "CONFLICT",
            message: "This undo request has expired or was already used.",
          });
        }
        await internal.addActivity(
          transaction,
          actorId,
          file.taskId,
          file.projectId,
          "file.restored",
          { fileId: file.id }
        );
      }),
  });
