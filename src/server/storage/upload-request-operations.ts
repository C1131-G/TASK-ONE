import { randomUUID } from "node:crypto";

import { Effect, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { StorageApi } from "./storage";
import type {
  AvatarUploadInput,
  FinalizedFile,
  RequestProjectUploadInput,
  RequestTaskUploadInput,
  UploadTicket,
} from "./uploads-contracts";
import * as internal from "./uploads-internal";

export const makeUploadRequestOperations = (storage: StorageApi) => {
  const requestTaskUpload = (
    actorId: string,
    rawInput: RequestTaskUploadInput
  ): Effect.Effect<UploadTicket, AppError> =>
    Effect.gen(function* requestUpload() {
      const input = yield* Effect.try({
        catch: internal.mapError,
        try: () => internal.validateUploadInput(rawInput),
      });
      const intent = yield* Effect.tryPromise({
        catch: internal.mapError,
        try: () =>
          db.transaction(async (transaction) => {
            const actor = await internal.getActor(transaction, actorId);
            const task = await internal.getEditableTask(
              transaction,
              actor,
              input.taskId
            );
            const id = randomUUID();
            const objectKey = `company/tasks/${task.id}/${randomUUID()}`;
            await transaction.orm.public.UploadIntent.create({
              contentType: input.contentType,
              createdAt: new Date(),
              expiresAt: new Date(Date.now() + internal.INTENT_LIFETIME_MS),
              fileName: input.fileName,
              finalizedAt: null,
              id,
              objectKey,
              ownerId: actorId,
              projectId: task.projectId,
              removedAt: null,
              sizeBytes: BigInt(input.sizeBytes),
              state: "pending",
              taskId: task.id,
              updatedAt: new Date(),
            });
            return { id, objectKey };
          }),
      });
      const uploadUrl = yield* storage.signUpload(
        intent.objectKey,
        input.contentType,
        input.sizeBytes
      );
      return {
        requiredHeaders: {
          "content-type": input.contentType,
          "if-none-match": "*",
        },
        uploadIntentId: intent.id,
        uploadUrl,
      };
    });

  const requestProjectUpload = (
    actorId: string,
    rawInput: RequestProjectUploadInput
  ): Effect.Effect<UploadTicket, AppError> =>
    Effect.gen(function* requestStandaloneProjectUpload() {
      const input = yield* Effect.try({
        catch: internal.mapError,
        try: () => internal.validateUploadInput(rawInput),
      });
      const intent = yield* Effect.tryPromise({
        catch: internal.mapError,
        try: () =>
          db.transaction(async (transaction) => {
            const actor = await internal.getActor(transaction, actorId);
            if (actor.role !== "admin") {
              throw new AppError({
                code: "FORBIDDEN",
                message: "Only admins can manage standalone project files.",
              });
            }
            await internal.assertActiveFileLocation(
              transaction,
              actor.role,
              null,
              input.projectId
            );
            const id = randomUUID();
            const objectKey = `company/files/${input.projectId}/${randomUUID()}`;
            const now = new Date();
            await transaction.orm.public.UploadIntent.create({
              contentType: input.contentType,
              createdAt: now,
              expiresAt: new Date(now.getTime() + internal.INTENT_LIFETIME_MS),
              fileName: input.fileName,
              finalizedAt: null,
              id,
              objectKey,
              ownerId: actorId,
              projectId: input.projectId,
              removedAt: null,
              sizeBytes: BigInt(input.sizeBytes),
              state: "pending",
              taskId: null,
              updatedAt: now,
            });
            return { id, objectKey };
          }),
      });
      const uploadUrl = yield* storage.signUpload(
        intent.objectKey,
        input.contentType,
        input.sizeBytes
      );
      return {
        requiredHeaders: {
          "content-type": input.contentType,
          "if-none-match": "*",
        },
        uploadIntentId: intent.id,
        uploadUrl,
      };
    });

  // eslint-disable-next-line unicorn/consistent-function-scoping -- Keep read and write operations together in the upload service layer.
  const listProjectFiles = (
    actorId: string,
    projectId: string
  ): Effect.Effect<readonly FinalizedFile[], AppError> =>
    Effect.tryPromise({
      catch: internal.mapError,
      try: async () => {
        const actorRole = await internal.activeRole(actorId);
        if (actorRole !== "admin") {
          throw new AppError({
            code: "FORBIDDEN",
            message: "Only admins can manage standalone project files.",
          });
        }
        const project = await db.orm.public.Project.where({ id: projectId })
          .select("id")
          .first();
        if (!project) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The project was not found.",
          });
        }
        const files = await db.orm.public.FileAsset.where({
          deletedAt: null,
          projectId,
          taskId: null,
        })
          .orderBy((file) => file.createdAt.desc())
          .all();
        return files.map(internal.toFinalizedFile);
      },
    });

  // eslint-disable-next-line unicorn/consistent-function-scoping -- Keep file queries grouped in the upload service layer.
  const listTaskFiles = (
    actorId: string,
    taskId: string
  ): Effect.Effect<readonly FinalizedFile[], AppError> =>
    Effect.tryPromise({
      catch: internal.mapError,
      try: async () => {
        await internal.activeRole(actorId);
        const task = await db.orm.public.Task.where({ id: taskId })
          .select("id")
          .first();
        if (!task) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The task was not found.",
          });
        }
        const files = await db.orm.public.FileAsset.where({
          deletedAt: null,
          taskId,
        })
          .orderBy((file) => file.createdAt.asc())
          .limit(100)
          .all();
        return files.map(internal.toFinalizedFile);
      },
    });

  const requestAvatarUpload = (
    actorId: string,
    rawInput: AvatarUploadInput
  ): Effect.Effect<UploadTicket, AppError> =>
    Effect.gen(function* requestEmployeeAvatarUpload() {
      const input = yield* Effect.try({
        catch: () =>
          new AppError({
            code: "VALIDATION_FAILED",
            message: "Avatars must be JPEG, PNG, or WebP images up to 5 MB.",
          }),
        try: () =>
          Schema.decodeUnknownSync(internal.AvatarUploadInputSchema)(rawInput),
      });
      const intent = yield* Effect.tryPromise({
        catch: internal.mapError,
        try: () =>
          db.transaction(async (transaction) => {
            await internal.getActor(transaction, actorId);
            const id = randomUUID();
            const objectKey = `company/avatars/${actorId}/${randomUUID()}`;
            const now = new Date();
            const extension =
              input.contentType === "image/jpeg"
                ? "jpg"
                : input.contentType.slice("image/".length);
            await transaction.orm.public.UploadIntent.create({
              contentType: input.contentType,
              createdAt: now,
              expiresAt: new Date(now.getTime() + internal.INTENT_LIFETIME_MS),
              fileName: `avatar.${extension}`,
              finalizedAt: null,
              id,
              objectKey,
              ownerId: actorId,
              projectId: null,
              removedAt: null,
              sizeBytes: BigInt(input.sizeBytes),
              state: "pending",
              taskId: null,
              updatedAt: now,
            });
            return { id, objectKey };
          }),
      });
      const uploadUrl = yield* storage.signUpload(
        intent.objectKey,
        input.contentType,
        input.sizeBytes
      );
      return {
        requiredHeaders: {
          "content-type": input.contentType,
          "if-none-match": "*",
        },
        uploadIntentId: intent.id,
        uploadUrl,
      };
    });

  return {
    listProjectFiles,
    listTaskFiles,
    requestAvatarUpload,
    requestProjectUpload,
    requestTaskUpload,
  };
};
