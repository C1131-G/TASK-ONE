import { randomUUID } from "node:crypto";

import { Effect, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { StorageApi } from "./storage";
import { assertClientCanReadFile } from "./uploads-client-access";
import type { FinalizedFile } from "./uploads-contracts";
import { toFinalizedFile } from "./uploads-finalized-file";
import * as internal from "./uploads-internal";

const uploadChangedError = () =>
  new AppError({
    code: "CONFLICT",
    message: "The upload request was already finalized or changed.",
  });

const unlinkedUploadError = () =>
  new AppError({
    code: "CONFLICT",
    message: "The upload request is not linked to project work.",
  });

// Checks the intent can be finalized; an already finalized intent is reported, not rejected, so retries are idempotent.
const checkUploadIntent = (actorId: string, uploadIntentId: string) =>
  db.transaction(async (transaction) => {
    const [actor, found] = await Promise.all([
      internal.getActor(transaction, actorId),
      transaction.orm.public.UploadIntent.where({ id: uploadIntentId }).first(),
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
        message: "The upload request has expired or is no longer pending.",
      });
    }
    if (!found.projectId) {
      throw unlinkedUploadError();
    }
    await internal.assertActiveFileLocation(
      transaction,
      actor.role,
      found.taskId,
      found.projectId
    );
    return { existing: false as const, record: found };
  });

const findFinalizedFile = async (objectKey: string): Promise<FinalizedFile> => {
  const file = await db.orm.public.FileAsset.where({
    deletedAt: null,
    storageKey: objectKey,
  }).first();
  if (!file) {
    throw new AppError({
      code: "CONFLICT",
      message: "The finalized file record is unavailable.",
    });
  }
  return toFinalizedFile(file);
};

// Re-checks the intent inside the write transaction because the object upload happened outside it.
const claimUploadIntent = (actorId: string, uploadIntentId: string) =>
  db.transaction(async (transaction) => {
    const [actor, current] = await Promise.all([
      internal.getActor(transaction, actorId),
      transaction.orm.public.UploadIntent.where({ id: uploadIntentId }).first(),
    ]);
    if (
      !current ||
      current.state !== "pending" ||
      current.ownerId !== actorId ||
      current.expiresAt <= new Date()
    ) {
      throw uploadChangedError();
    }
    const { projectId } = current;
    if (!projectId) {
      throw unlinkedUploadError();
    }
    await internal.assertActiveFileLocation(
      transaction,
      actor.role,
      current.taskId,
      projectId
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
      throw uploadChangedError();
    }
    const file = await transaction.orm.public.FileAsset.create({
      contentType: current.contentType,
      createdAt: now,
      deletedAt: null,
      deletedById: null,
      id: randomUUID(),
      originalName: current.fileName,
      projectId,
      sizeBytes: current.sizeBytes,
      storageKey: current.objectKey,
      taskId: current.taskId,
      uploadedById: actorId,
    });
    await internal.addActivity(
      transaction,
      actorId,
      current.taskId,
      projectId,
      "file.uploaded",
      { fileId: file.id }
    );
    return toFinalizedFile(file);
  });

// Shared by download and preview: the file must be ready, and standalone project files are admin-only.
const findReadableFile = async (actorId: string, fileId: string) => {
  const [actor, file] = await Promise.all([
    internal.activeActor(actorId),
    db.orm.public.FileAsset.where({ deletedAt: null, id: fileId }).first(),
  ]);
  if (!file) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "The file was not found.",
    });
  }
  const actorRole = actor.role;
  if (actorRole === "client") {
    await assertClientCanReadFile(actor, file);
  }
  if (file.copyState !== "ready") {
    throw new AppError({
      code: "CONFLICT",
      message: "The file copy is still processing or has failed.",
    });
  }
  if (file.taskId) {
    const task = await db.orm.public.Task.where({ id: file.taskId })
      .select("id")
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
  return file;
};

export const makeFileReadOperations = (storage: StorageApi) => {
  const finalizeUpload = (
    actorId: string,
    uploadIntentId: string
  ): Effect.Effect<FinalizedFile, AppError> =>
    Effect.gen(function* finalizeTaskUpload() {
      const intent = yield* Effect.tryPromise({
        catch: internal.mapError,
        try: () => checkUploadIntent(actorId, uploadIntentId),
      });
      if (intent.existing) {
        return yield* Effect.tryPromise({
          catch: internal.mapError,
          try: () => findFinalizedFile(intent.record.objectKey),
        });
      }
      yield* storage.verifyObject(
        intent.record.objectKey,
        intent.record.contentType,
        Number(intent.record.sizeBytes)
      );
      return yield* Effect.tryPromise({
        catch: internal.mapError,
        try: () => claimUploadIntent(actorId, uploadIntentId),
      });
    });

  const signedDownload = (
    actorId: string,
    fileId: string
  ): Effect.Effect<string, AppError> =>
    Effect.gen(function* signFileDownload() {
      const file = yield* Effect.tryPromise({
        catch: internal.mapError,
        try: () => findReadableFile(actorId, fileId),
      });
      return yield* storage.signDownload(file.storageKey, file.originalName);
    });

  const signedPreview = (
    actorId: string,
    fileId: string
  ): Effect.Effect<string, AppError> =>
    Effect.gen(function* signFilePreview() {
      const file = yield* Effect.tryPromise({
        catch: internal.mapError,
        try: () => findReadableFile(actorId, fileId),
      });
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
