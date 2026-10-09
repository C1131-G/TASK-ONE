import { randomUUID } from "node:crypto";

import { and } from "@prisma/orm-postgres/orm-client";
import { Context, Effect, Layer, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { MimeTypeSchema } from "../core/input-schemas";
import { Storage } from "./storage";
import type { StorageApi } from "./storage";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const INTENT_LIFETIME_MS = 15 * 60 * 1000;
const UNDO_LIFETIME_MS = 5 * 60 * 1000;
const ORPHAN_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;
const AvatarUploadInputSchema = Schema.Struct({
  contentType: Schema.Literals(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThan(0),
    Schema.isLessThanOrEqualTo(MAX_AVATAR_BYTES)
  ),
});
const PreviewContentTypeSchema = Schema.Literals([
  "application/pdf",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export interface RequestTaskUploadInput {
  readonly taskId: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
}
export interface RequestProjectUploadInput {
  readonly projectId: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
}
export interface UploadTicket {
  readonly uploadIntentId: string;
  readonly uploadUrl: string;
  readonly requiredHeaders: {
    readonly "content-type": string;
    readonly "if-none-match": "*";
  };
}
export const FinalizedFileSchema = Schema.Struct({
  contentType: Schema.String,
  copyState: Schema.Literals(["pending", "ready", "failed"]),
  createdAt: Schema.String,
  id: Schema.String,
  originalName: Schema.String,
  projectId: Schema.String,
  sizeBytes: Schema.Number,
  taskId: Schema.NullOr(Schema.String),
  uploadedById: Schema.String,
});

export const FileUndoReceiptSchema = Schema.Struct({
  expiresAt: Schema.String,
  undoId: Schema.String,
});

export const AvatarUploadResultSchema = Schema.Struct({
  contentType: Schema.String,
  sizeBytes: Schema.Number,
});

export const FileCopyResultSchema = Schema.Struct({
  fileId: Schema.String,
  state: Schema.Literals(["pending", "ready", "failed"]),
});

export interface FinalizedFile {
  readonly id: string;
  readonly projectId: string;
  readonly taskId: string | null;
  readonly originalName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly uploadedById: string;
  readonly createdAt: string;
  readonly copyState: "pending" | "ready" | "failed";
}
export interface UndoReceipt {
  readonly undoId: string;
  readonly expiresAt: string;
}
export interface AvatarUploadInput {
  readonly contentType: "image/jpeg" | "image/png" | "image/webp";
  readonly sizeBytes: number;
}
export interface AvatarUploadResult {
  readonly contentType: AvatarUploadInput["contentType"];
  readonly sizeBytes: number;
}
export interface FileCopyResult {
  readonly fileId: string;
  readonly state: "pending" | "ready" | "failed";
}

export class Uploads extends Context.Service<
  Uploads,
  {
    readonly requestTaskUpload: (
      actorId: string,
      input: RequestTaskUploadInput
    ) => Effect.Effect<UploadTicket, AppError>;
    readonly requestProjectUpload: (
      actorId: string,
      input: RequestProjectUploadInput
    ) => Effect.Effect<UploadTicket, AppError>;
    readonly listProjectFiles: (
      actorId: string,
      projectId: string
    ) => Effect.Effect<readonly FinalizedFile[], AppError>;
    readonly listTaskFiles: (
      actorId: string,
      taskId: string
    ) => Effect.Effect<readonly FinalizedFile[], AppError>;
    readonly requestAvatarUpload: (
      actorId: string,
      input: AvatarUploadInput
    ) => Effect.Effect<UploadTicket, AppError>;
    readonly finalizeAvatarUpload: (
      actorId: string,
      uploadIntentId: string
    ) => Effect.Effect<AvatarUploadResult, AppError>;
    readonly signedAvatar: (
      requesterId: string,
      targetUserId: string
    ) => Effect.Effect<string | null, AppError>;
    readonly finalizeUpload: (
      actorId: string,
      uploadIntentId: string
    ) => Effect.Effect<FinalizedFile, AppError>;
    readonly signedDownload: (
      actorId: string,
      fileId: string
    ) => Effect.Effect<string, AppError>;
    readonly signedPreview: (
      actorId: string,
      fileId: string
    ) => Effect.Effect<string, AppError>;
    readonly requestFileCopy: (
      actorId: string,
      fileId: string
    ) => Effect.Effect<FileCopyResult, AppError>;
    readonly processFileCopy: (
      sourceFileId: string,
      targetFileId: string,
      sourceKey: string,
      targetKey: string
    ) => Effect.Effect<void, AppError>;
    readonly renameFile: (
      actorId: string,
      fileId: string,
      fileName: string
    ) => Effect.Effect<FinalizedFile, AppError>;
    readonly removeFile: (
      actorId: string,
      fileId: string
    ) => Effect.Effect<UndoReceipt, AppError>;
    readonly undoFileRemoval: (
      actorId: string,
      undoId: string
    ) => Effect.Effect<void, AppError>;
    readonly cleanupExpiredUploads: () => Effect.Effect<
      {
        readonly filesRemoved: number;
        readonly intentsRemoved: number;
        readonly orphansRemoved: number;
      },
      AppError
    >;
  }
>()("metsys/server/Uploads") {}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Role = "admin" | "employee";

const mapError = (error: unknown): AppError => {
  if (error instanceof AppError) {
    return error;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  ) {
    return new AppError({
      code: "CONFLICT",
      message: "The file or upload request already exists.",
    });
  }
  return new AppError({
    code: "UNAVAILABLE",
    message: "The file request could not be completed.",
  });
};

const normalizeFileName = (input: string): string => {
  const name = input.replaceAll("\\", "/").split("/").at(-1)?.trim() ?? "";
  const hasControl = [...name].some((character) => {
    const point = character.codePointAt(0);
    return (
      point !== undefined && (point < 32 || (point >= 127 && point <= 159))
    );
  });
  if (
    !name ||
    name.length > 180 ||
    hasControl ||
    name === "." ||
    name === ".."
  ) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Choose a valid file name up to 180 characters long.",
    });
  }
  return name;
};

const validateUploadInput = <
  Input extends {
    readonly fileName: string;
    readonly contentType: string;
    readonly sizeBytes: number;
  },
>(
  input: Input
): Input => {
  const fileName = normalizeFileName(input.fileName);
  const contentType = input.contentType.trim().toLowerCase();
  if (!Schema.is(MimeTypeSchema)(contentType)) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Choose a valid file content type.",
    });
  }
  if (
    !Number.isSafeInteger(input.sizeBytes) ||
    input.sizeBytes < 1 ||
    input.sizeBytes > MAX_UPLOAD_BYTES
  ) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Files must be between 1 byte and 50 MB.",
    });
  }
  return { ...input, contentType, fileName };
};

const getActor = async (transaction: Transaction, actorId: string) => {
  const actor = await transaction.orm.public.User.where({ id: actorId })
    .select("id", "role", "mustChangePassword", "deactivatedAt")
    .first();
  if (!actor || actor.deactivatedAt) {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Sign in to continue.",
    });
  }
  if (actor.mustChangePassword) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Change your password before continuing.",
    });
  }
  return actor;
};

const getEditableTask = async (
  transaction: Transaction,
  actor: { id: string; role: string },
  taskId: string
) => {
  const task = await transaction.orm.public.Task.include("project")
    .where({ id: taskId })
    .first();
  if (!task) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "The task was not found.",
    });
  }
  if (task.archivedAt || task.project.archivedAt) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Archived work is read only.",
    });
  }
  if (actor.role === "admin" || task.createdById === actor.id) {
    return task;
  }
  const assignment = await transaction.orm.public.TaskAssignee.where({
    taskId,
    userId: actor.id,
  })
    .select("taskId")
    .first();
  if (!assignment) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "You cannot edit this task.",
    });
  }
  return task;
};

const activeRole = async (actorId: string): Promise<Role> => {
  const actor = await db.orm.public.User.where({ id: actorId })
    .select("role", "deactivatedAt", "mustChangePassword")
    .first();
  if (!actor || actor.deactivatedAt) {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Sign in to continue.",
    });
  }
  if (actor.mustChangePassword) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Change your password before continuing.",
    });
  }
  return actor.role === "admin" ? "admin" : "employee";
};

const toFinalizedFile = (file: {
  id: string;
  projectId: string;
  taskId: string | null;
  originalName: string;
  contentType: string | null;
  sizeBytes: bigint;
  copyState: string;
  uploadedById: string;
  createdAt: Date;
}): FinalizedFile => {
  if (!file.contentType) {
    throw new AppError({
      code: "CONFLICT",
      message: "The finalized file metadata is incomplete.",
    });
  }
  return {
    contentType: file.contentType,
    copyState: file.copyState as FileCopyResult["state"],
    createdAt: file.createdAt.toISOString(),
    id: file.id,
    originalName: file.originalName,
    projectId: file.projectId,
    sizeBytes: Number(file.sizeBytes),
    taskId: file.taskId,
    uploadedById: file.uploadedById,
  };
};

const addActivity = async (
  transaction: Transaction,
  actorId: string,
  taskId: string | null,
  projectId: string,
  action: string,
  details: Record<string, string>
) => {
  await transaction.orm.public.Activity.create({
    action,
    actorId,
    createdAt: new Date(),
    details,
    id: randomUUID(),
    projectId,
    taskId,
  });
};

// eslint-disable-next-line func-style -- Hoisting keeps this permission helper available to the upload Layer methods below.
async function assertActiveFileLocation(
  transaction: Transaction,
  actorRole: string,
  taskId: string | null,
  projectId: string
): Promise<void> {
  if (taskId) {
    const task = await transaction.orm.public.Task.include("project")
      .where({ id: taskId })
      .first();
    if (!task) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "The task was not found.",
      });
    }
    if (task.archivedAt || task.project.archivedAt) {
      throw new AppError({
        code: "FORBIDDEN",
        message: "Archived work is read only.",
      });
    }
    return;
  }
  if (actorRole !== "admin") {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Only admins can manage standalone project files.",
    });
  }
  const project = await transaction.orm.public.Project.where({ id: projectId })
    .select("archivedAt")
    .first();
  if (!project || project.archivedAt) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Archived work is read only.",
    });
  }
}

const makeUploads = (storage: StorageApi) => {
  // eslint-disable-next-line unicorn/consistent-function-scoping -- Kept with upload and file lifecycle commands.
  const requestFileCopy = (
    actorId: string,
    fileId: string
  ): Effect.Effect<FileCopyResult, AppError> =>
    Effect.tryPromise({
      catch: mapError,
      try: () =>
        db.transaction(async (transaction) => {
          const [actor, source] = await Promise.all([
            getActor(transaction, actorId),
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
            await getEditableTask(transaction, actor, source.taskId);
          } else {
            if (actor.role !== "admin") {
              throw new AppError({
                code: "FORBIDDEN",
                message: "Only admins can duplicate standalone project files.",
              });
            }
            await assertActiveFileLocation(
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
            originalName: normalizeFileName(fileName),
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
          await addActivity(
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

  const processFileCopy = (
    sourceFileId: string,
    targetFileId: string,
    sourceKey: string,
    targetKey: string
  ): Effect.Effect<void, AppError> =>
    Effect.gen(function* processCopy() {
      const pair = yield* Effect.tryPromise({
        catch: mapError,
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
          catch: mapError,
          try: () =>
            db.orm.public.FileAsset.where({ id: targetFileId }).update({
              copyError: "Storage copy failed.",
              copyState: "failed",
            }),
        });
        return yield* Effect.fail(copied.failure);
      }
      yield* Effect.tryPromise({
        catch: mapError,
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

  const requestTaskUpload = (
    actorId: string,
    rawInput: RequestTaskUploadInput
  ): Effect.Effect<UploadTicket, AppError> =>
    Effect.gen(function* requestUpload() {
      const input = yield* Effect.try({
        catch: mapError,
        try: () => validateUploadInput(rawInput),
      });
      const intent = yield* Effect.tryPromise({
        catch: mapError,
        try: () =>
          db.transaction(async (transaction) => {
            const actor = await getActor(transaction, actorId);
            const task = await getEditableTask(
              transaction,
              actor,
              input.taskId
            );
            const id = randomUUID();
            const objectKey = `company/tasks/${task.id}/${randomUUID()}`;
            await transaction.orm.public.UploadIntent.create({
              contentType: input.contentType,
              createdAt: new Date(),
              expiresAt: new Date(Date.now() + INTENT_LIFETIME_MS),
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
        catch: mapError,
        try: () => validateUploadInput(rawInput),
      });
      const intent = yield* Effect.tryPromise({
        catch: mapError,
        try: () =>
          db.transaction(async (transaction) => {
            const actor = await getActor(transaction, actorId);
            if (actor.role !== "admin") {
              throw new AppError({
                code: "FORBIDDEN",
                message: "Only admins can manage standalone project files.",
              });
            }
            await assertActiveFileLocation(
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
              expiresAt: new Date(now.getTime() + INTENT_LIFETIME_MS),
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
      catch: mapError,
      try: async () => {
        const actorRole = await activeRole(actorId);
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
        return files.map(toFinalizedFile);
      },
    });

  // eslint-disable-next-line unicorn/consistent-function-scoping -- Keep file queries grouped in the upload service layer.
  const listTaskFiles = (
    actorId: string,
    taskId: string
  ): Effect.Effect<readonly FinalizedFile[], AppError> =>
    Effect.tryPromise({
      catch: mapError,
      try: async () => {
        await activeRole(actorId);
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
        return files.map(toFinalizedFile);
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
        try: () => Schema.decodeUnknownSync(AvatarUploadInputSchema)(rawInput),
      });
      const intent = yield* Effect.tryPromise({
        catch: mapError,
        try: () =>
          db.transaction(async (transaction) => {
            await getActor(transaction, actorId);
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
              expiresAt: new Date(now.getTime() + INTENT_LIFETIME_MS),
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

  const finalizeAvatarUpload = (
    actorId: string,
    uploadIntentId: string
  ): Effect.Effect<AvatarUploadResult, AppError> =>
    Effect.gen(function* finalizeEmployeeAvatarUpload() {
      const intent = yield* Effect.tryPromise({
        catch: mapError,
        try: () =>
          db.transaction(async (transaction) => {
            await getActor(transaction, actorId);
            const found = await transaction.orm.public.UploadIntent.where({
              id: uploadIntentId,
            }).first();
            if (!found || found.ownerId !== actorId) {
              throw new AppError({
                code: "NOT_FOUND",
                message: "The avatar upload request was not found.",
              });
            }
            if (!found.objectKey.startsWith(`company/avatars/${actorId}/`)) {
              throw new AppError({
                code: "FORBIDDEN",
                message: "This upload is not an avatar request.",
              });
            }
            if (found.state === "finalized") {
              return { alreadyFinalized: true as const, record: found };
            }
            if (
              found.state !== "pending" ||
              found.expiresAt <= new Date() ||
              found.taskId ||
              found.projectId ||
              !Schema.is(AvatarUploadInputSchema.fields.contentType)(
                found.contentType
              ) ||
              found.sizeBytes > BigInt(MAX_AVATAR_BYTES)
            ) {
              throw new AppError({
                code: "CONFLICT",
                message: "The avatar upload request expired or changed.",
              });
            }
            return { alreadyFinalized: false as const, record: found };
          }),
      });
      if (!intent.alreadyFinalized) {
        yield* storage.verifyObject(
          intent.record.objectKey,
          intent.record.contentType,
          Number(intent.record.sizeBytes)
        );
      }
      const result = yield* Effect.tryPromise({
        catch: mapError,
        try: () =>
          db.transaction(async (transaction) => {
            await getActor(transaction, actorId);
            const current = await transaction.orm.public.UploadIntent.where({
              id: uploadIntentId,
              ownerId: actorId,
            }).first();
            if (!current) {
              throw new AppError({
                code: "NOT_FOUND",
                message: "The avatar upload request was not found.",
              });
            }
            if (
              !current.objectKey.startsWith(`company/avatars/${actorId}/`) ||
              !Schema.is(AvatarUploadInputSchema.fields.contentType)(
                current.contentType
              )
            ) {
              throw new AppError({
                code: "CONFLICT",
                message: "The avatar upload request changed.",
              });
            }
            if (current.state !== "finalized") {
              if (
                current.state !== "pending" ||
                current.expiresAt <= new Date() ||
                current.taskId ||
                current.projectId ||
                current.sizeBytes > BigInt(MAX_AVATAR_BYTES)
              ) {
                throw new AppError({
                  code: "CONFLICT",
                  message: "The avatar upload request expired or changed.",
                });
              }
              const now = new Date();
              const claimed = await transaction.orm.public.UploadIntent.where({
                id: uploadIntentId,
                state: "pending",
              }).updateAndCount({
                finalizedAt: now,
                state: "finalized",
                updatedAt: now,
              });
              if (!claimed) {
                throw new AppError({
                  code: "CONFLICT",
                  message: "The avatar upload request was already finalized.",
                });
              }
              const previousAvatar = await transaction.orm.public.User.where({
                id: actorId,
              })
                .select("image")
                .first();
              await transaction.orm.public.User.where({ id: actorId }).update({
                image: current.objectKey,
                updatedAt: now,
              });
              if (
                previousAvatar?.image?.startsWith("company/avatars/") &&
                previousAvatar.image !== current.objectKey
              ) {
                const jobId = randomUUID();
                await transaction.orm.public.Job.create({
                  availableAt: now,
                  createdAt: now,
                  dedupeKey: `storage.delete-avatar:${current.objectKey}`,
                  id: jobId,
                  kind: "storage.delete-avatar",
                  maxAttempts: 8,
                  payload: { objectKey: previousAvatar.image },
                  updatedAt: now,
                });
              }
            }
            return {
              contentType:
                current.contentType as AvatarUploadInput["contentType"],
              sizeBytes: Number(current.sizeBytes),
            };
          }),
      });
      return result;
    });

  const signedAvatar = (
    requesterId: string,
    targetUserId: string
  ): Effect.Effect<string | null, AppError> =>
    Effect.gen(function* signEmployeeAvatar() {
      yield* Effect.tryPromise({
        catch: mapError,
        try: () => activeRole(requesterId),
      });
      const user = yield* Effect.tryPromise({
        catch: mapError,
        try: () =>
          db.orm.public.User.where({
            deactivatedAt: null,
            id: targetUserId,
          })
            .select("image")
            .first(),
      });
      const objectKey = user?.image;
      if (!objectKey?.startsWith("company/avatars/")) {
        return null;
      }
      const intent = yield* Effect.tryPromise({
        catch: mapError,
        try: () =>
          db.orm.public.UploadIntent.where({
            objectKey,
            state: "finalized",
          })
            .select("contentType")
            .first(),
      });
      if (
        !intent ||
        !Schema.is(AvatarUploadInputSchema.fields.contentType)(
          intent.contentType
        )
      ) {
        return null;
      }
      return yield* storage.signPreview(objectKey, intent.contentType);
    });

  const finalizeUpload = (
    actorId: string,
    uploadIntentId: string
  ): Effect.Effect<FinalizedFile, AppError> =>
    Effect.gen(function* finalizeTaskUpload() {
      const intent = yield* Effect.tryPromise({
        catch: mapError,
        try: () =>
          db.transaction(async (transaction) => {
            const [actor, found] = await Promise.all([
              getActor(transaction, actorId),
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
            await assertActiveFileLocation(
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
          catch: mapError,
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
        return toFinalizedFile(file);
      }
      yield* storage.verifyObject(
        intent.record.objectKey,
        intent.record.contentType,
        Number(intent.record.sizeBytes)
      );
      return yield* Effect.tryPromise({
        catch: mapError,
        try: () =>
          db.transaction(async (transaction) => {
            const [actor, current] = await Promise.all([
              getActor(transaction, actorId),
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
            await assertActiveFileLocation(
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
            await addActivity(
              transaction,
              actorId,
              current.taskId,
              current.projectId,
              "file.uploaded",
              { fileId: file.id }
            );
            return toFinalizedFile(file);
          }),
      });
    });

  const signedDownload = (
    actorId: string,
    fileId: string
  ): Effect.Effect<string, AppError> =>
    Effect.gen(function* signFileDownload() {
      const file = yield* Effect.tryPromise({
        catch: mapError,
        try: async () => {
          const [actorRole, found] = await Promise.all([
            activeRole(actorId),
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
        catch: mapError,
        try: () => activeRole(actorId),
      });
      const file = yield* Effect.tryPromise({
        catch: mapError,
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
      if (file.taskId) {
        const task = yield* Effect.tryPromise({
          catch: mapError,
          try: () =>
            db.orm.public.Task.where({ id: file.taskId as string })
              .select("id")
              .first(),
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
      if (!Schema.is(PreviewContentTypeSchema)(file.contentType)) {
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
  const renameFile = (
    actorId: string,
    fileId: string,
    rawFileName: string
  ): Effect.Effect<FinalizedFile, AppError> =>
    Effect.tryPromise({
      catch: mapError,
      try: () =>
        db.transaction(async (transaction) => {
          const [actor, file] = await Promise.all([
            getActor(transaction, actorId),
            transaction.orm.public.FileAsset.where({ id: fileId }).first(),
          ]);
          if (!file || file.deletedAt) {
            throw new AppError({
              code: "NOT_FOUND",
              message: "The active file was not found.",
            });
          }
          if (file.taskId) {
            await getEditableTask(transaction, actor, file.taskId);
          } else if (actor.role !== "admin") {
            throw new AppError({
              code: "FORBIDDEN",
              message: "Only admins can manage standalone project files.",
            });
          }
          const fileName = normalizeFileName(rawFileName);
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
          await addActivity(
            transaction,
            actorId,
            file.taskId,
            file.projectId,
            "file.renamed",
            { fileId, name: fileName }
          );
          return toFinalizedFile(updated);
        }),
    });

  // eslint-disable-next-line unicorn/consistent-function-scoping -- Keep upload methods grouped in the Layer constructor.
  const removeFile = (
    actorId: string,
    fileId: string
  ): Effect.Effect<UndoReceipt, AppError> =>
    Effect.tryPromise({
      catch: mapError,
      try: () =>
        db.transaction(async (transaction) => {
          const [actor, file] = await Promise.all([
            getActor(transaction, actorId),
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
          await assertActiveFileLocation(
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
          const expiresAt = new Date(now.getTime() + UNDO_LIFETIME_MS);
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
          await addActivity(
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
  const undoFileRemoval = (
    actorId: string,
    undoId: string
  ): Effect.Effect<void, AppError> =>
    Effect.tryPromise({
      catch: mapError,
      try: () =>
        db.transaction(async (transaction) => {
          const [actor, undo] = await Promise.all([
            getActor(transaction, actorId),
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
          await assertActiveFileLocation(
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
          await addActivity(
            transaction,
            actorId,
            file.taskId,
            file.projectId,
            "file.restored",
            { fileId: file.id }
          );
        }),
    });

  const cleanupExpiredUploads = (): Effect.Effect<
    {
      readonly filesRemoved: number;
      readonly intentsRemoved: number;
      readonly orphansRemoved: number;
    },
    AppError
  > =>
    Effect.gen(function* cleanupExpiredUploadData() {
      const now = new Date();
      yield* Effect.tryPromise({
        catch: mapError,
        try: () =>
          db.orm.public.IdempotencyKey.where((record) =>
            record.expiresAt.lte(now)
          ).deleteAll(),
      });
      const expiredIntents = yield* Effect.tryPromise({
        catch: mapError,
        try: () =>
          db.orm.public.UploadIntent.where((intent) =>
            and(intent.state.eq("pending"), intent.expiresAt.lte(now))
          )
            .orderBy((intent) => intent.expiresAt.asc())
            .limit(100)
            .all(),
      });
      let intentsRemoved = 0;
      for (const intent of expiredIntents) {
        yield* storage.deleteObject(intent.objectKey);
        const updated = yield* Effect.tryPromise({
          catch: mapError,
          try: () =>
            db.orm.public.UploadIntent.where({
              id: intent.id,
              state: "pending",
            }).updateAndCount({
              removedAt: now,
              state: "removed",
              updatedAt: now,
            }),
        });
        if (updated) {
          intentsRemoved += 1;
        }
      }

      const removalCutoff = new Date(now.getTime() - UNDO_LIFETIME_MS);
      const expiredRemovedFiles = yield* Effect.tryPromise({
        catch: mapError,
        try: () =>
          db.orm.public.FileAsset.where((file) =>
            file.deletedAt.lte(removalCutoff)
          )
            .orderBy((file) => file.deletedAt.asc())
            .limit(100)
            .all(),
      });
      let filesRemoved = 0;
      for (const file of expiredRemovedFiles) {
        const activeUndo = yield* Effect.tryPromise({
          catch: mapError,
          try: () =>
            db.orm.public.UndoRecord.where((undo) =>
              and(
                undo.action.eq("file.remove"),
                undo.entityId.eq(file.id),
                undo.consumedAt.isNull(),
                undo.expiresAt.gt(now)
              )
            )
              .select("id")
              .first(),
        });
        if (activeUndo) {
          continue;
        }
        yield* storage.deleteObject(file.storageKey);
        const deleted = yield* Effect.tryPromise({
          catch: mapError,
          try: () =>
            db.orm.public.FileAsset.where((current) =>
              and(current.id.eq(file.id), current.deletedAt.lte(removalCutoff))
            ).delete(),
        });
        if (deleted) {
          filesRemoved += 1;
        }
      }
      const { listObjects } = storage;
      if (!listObjects) {
        return { filesRemoved, intentsRemoved, orphansRemoved: 0 };
      }
      const [files, intents] = yield* Effect.tryPromise({
        catch: mapError,
        try: () =>
          Promise.all([
            db.orm.public.FileAsset.select("storageKey").all(),
            db.orm.public.UploadIntent.where((intent) =>
              intent.state.neq("removed")
            )
              .select("objectKey")
              .all(),
          ]),
      });
      const knownKeys = new Set([
        ...files.map(({ storageKey }) => storageKey),
        ...intents.map(({ objectKey }) => objectKey),
      ]);
      const orphanCutoff = new Date(now.getTime() - ORPHAN_GRACE_PERIOD_MS);
      const [taskObjects, copiedObjects] = yield* Effect.all(
        [listObjects("company/tasks/"), listObjects("company/files/")],
        { concurrency: 2 }
      );
      const orphanKeys = [...taskObjects, ...copiedObjects]
        .filter(
          ({ key, lastModified }) =>
            !knownKeys.has(key) &&
            lastModified !== null &&
            lastModified < orphanCutoff
        )
        .slice(0, 100)
        .map(({ key }) => key);
      yield* Effect.forEach(orphanKeys, (key) => storage.deleteObject(key), {
        concurrency: 10,
      });
      return {
        filesRemoved,
        intentsRemoved,
        orphansRemoved: orphanKeys.length,
      };
    });

  return Uploads.of({
    cleanupExpiredUploads,
    finalizeAvatarUpload,
    finalizeUpload,
    listProjectFiles,
    listTaskFiles,
    processFileCopy,
    removeFile,
    renameFile,
    requestAvatarUpload,
    requestFileCopy,
    requestProjectUpload,
    requestTaskUpload,
    signedAvatar,
    signedDownload,
    signedPreview,
    undoFileRemoval,
  });
};

export const UploadsLive = Layer.effect(
  Uploads,
  Effect.map(Effect.service(Storage), makeUploads)
);
