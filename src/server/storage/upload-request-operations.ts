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

interface PendingUpload {
  readonly contentType: string;
  readonly fileName: string;
  readonly objectKey: string;
  readonly projectId: string | null;
  readonly sizeBytes: number;
  readonly taskId: string | null;
}

interface CreatedIntent {
  readonly id: string;
  readonly objectKey: string;
}

const createUploadIntent = async (
  transaction: internal.Transaction,
  actorId: string,
  upload: PendingUpload
): Promise<CreatedIntent> => {
  const id = randomUUID();
  const now = new Date();
  await transaction.orm.public.UploadIntent.create({
    contentType: upload.contentType,
    createdAt: now,
    expiresAt: new Date(now.getTime() + internal.INTENT_LIFETIME_MS),
    fileName: upload.fileName,
    finalizedAt: null,
    id,
    objectKey: upload.objectKey,
    ownerId: actorId,
    projectId: upload.projectId,
    removedAt: null,
    sizeBytes: BigInt(upload.sizeBytes),
    state: "pending",
    taskId: upload.taskId,
    updatedAt: now,
  });
  return { id, objectKey: upload.objectKey };
};

const avatarExtension = (contentType: string): string =>
  contentType === "image/jpeg" ? "jpg" : contentType.slice("image/".length);

const requireStandaloneFileAdmin = (role: string): void => {
  if (role !== "admin") {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Only admins can manage standalone project files.",
    });
  }
};

const listProjectFiles = (
  actorId: string,
  projectId: string
): Effect.Effect<readonly FinalizedFile[], AppError> =>
  Effect.tryPromise({
    catch: internal.mapError,
    try: async () => {
      requireStandaloneFileAdmin(await internal.activeRole(actorId));
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

const listTaskFiles = (
  actorId: string,
  taskId: string
): Effect.Effect<readonly FinalizedFile[], AppError> =>
  Effect.tryPromise({
    catch: internal.mapError,
    try: async () => {
      // Clients see attachments only through the portal's own safe lists.
      if ((await internal.activeRole(actorId)) === "client") {
        throw new AppError({
          code: "FORBIDDEN",
          message: "This area is only available to workspace members.",
        });
      }
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

export const makeUploadRequestOperations = (storage: StorageApi) => {
  // The if-none-match header stops a signed upload from replacing an object that already exists.
  const issueUploadTicket = (
    intent: CreatedIntent,
    contentType: string,
    sizeBytes: number
  ): Effect.Effect<UploadTicket, AppError> =>
    Effect.map(
      storage.signUpload(intent.objectKey, contentType, sizeBytes),
      (uploadUrl) => ({
        requiredHeaders: {
          "content-type": contentType,
          "if-none-match": "*",
        },
        uploadIntentId: intent.id,
        uploadUrl,
      })
    );

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
            if (actor.role === "client") {
              await internal.assertClientUploadAllowed(
                transaction,
                task.id,
                input
              );
            }
            return createUploadIntent(transaction, actorId, {
              contentType: input.contentType,
              fileName: input.fileName,
              objectKey: `company/tasks/${task.id}/${randomUUID()}`,
              projectId: task.projectId,
              sizeBytes: input.sizeBytes,
              taskId: task.id,
            });
          }),
      });
      return yield* issueUploadTicket(
        intent,
        input.contentType,
        input.sizeBytes
      );
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
            requireStandaloneFileAdmin(actor.role);
            await internal.assertActiveFileLocation(
              transaction,
              actor.role,
              null,
              input.projectId
            );
            return createUploadIntent(transaction, actorId, {
              contentType: input.contentType,
              fileName: input.fileName,
              objectKey: `company/files/${input.projectId}/${randomUUID()}`,
              projectId: input.projectId,
              sizeBytes: input.sizeBytes,
              taskId: null,
            });
          }),
      });
      return yield* issueUploadTicket(
        intent,
        input.contentType,
        input.sizeBytes
      );
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
            return createUploadIntent(transaction, actorId, {
              contentType: input.contentType,
              fileName: `avatar.${avatarExtension(input.contentType)}`,
              objectKey: `company/avatars/${actorId}/${randomUUID()}`,
              projectId: null,
              sizeBytes: input.sizeBytes,
              taskId: null,
            });
          }),
      });
      return yield* issueUploadTicket(
        intent,
        input.contentType,
        input.sizeBytes
      );
    });

  return {
    listProjectFiles,
    listTaskFiles,
    requestAvatarUpload,
    requestProjectUpload,
    requestTaskUpload,
  };
};
