"use server";

import { Effect, Schema, Layer } from "effect";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { AppError } from "@/src/server/core/action-result";
import type { ActionResult } from "@/src/server/core/action-result";
import {
  DoneResultSchema,
  Idempotency,
  IdempotencyLive,
} from "@/src/server/core/idempotency";
import {
  IdempotencyKeySchema,
  MimeTypeSchema,
  UUIDSchema,
} from "@/src/server/core/input-schemas";
import { runServerAction } from "@/src/server/core/server-action";
import { StorageLive } from "@/src/server/storage/storage";
import {
  AvatarUploadResultSchema,
  FileCopyResultSchema,
  FileUndoReceiptSchema,
  FinalizedFileSchema,
  FinalizedFileListSchema,
  UploadTicketSchema,
  Uploads,
  UploadsLive,
} from "@/src/server/storage/uploads";

const runUploadAction = <
  InputSchema extends Schema.Codec<unknown, unknown, never, never>,
  Result,
>(
  input: unknown,
  schema: InputSchema,
  execute: (
    userId: string,
    validated: InputSchema["Type"]
  ) => Effect.Effect<Result, AppError, Uploads | Idempotency>,
  outputSchema?: Schema.Codec<unknown, unknown, never, never>
): Promise<ActionResult<Result>> =>
  runServerAction(
    input,
    schema,
    (validated) =>
      Effect.gen(function* authorizeUploadAction() {
        const requestHeaders = yield* Effect.tryPromise({
          catch: () =>
            new AppError({
              code: "UNAVAILABLE",
              message: "The request could not be completed.",
            }),
          try: () => headers(),
        });
        const sessions = yield* AuthSession;
        const user = yield* sessions.requireWorkspaceAccess(requestHeaders);
        return yield* execute(user.id, validated).pipe(
          Effect.provide(Layer.provide(UploadsLive, StorageLive)),
          Effect.provide(IdempotencyLive)
        );
      }).pipe(Effect.provide(AuthSessionLive)),
    undefined,
    outputSchema
  );

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function requestTaskUploadAction(input: unknown) {
  const result = await runUploadAction(
    input,
    Schema.Struct({
      contentType: MimeTypeSchema,
      fileName: Schema.String,
      sizeBytes: Schema.Number,
      taskId: UUIDSchema,
    }),
    (userId, validated) =>
      Effect.gen(function* requestTaskUpload() {
        const uploads = yield* Uploads;
        return yield* uploads.requestTaskUpload(userId, validated);
      }),
    UploadTicketSchema
  );
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function requestProjectUploadAction(input: unknown) {
  return await runUploadAction(
    input,
    Schema.Struct({
      contentType: MimeTypeSchema,
      fileName: Schema.String,
      projectId: UUIDSchema,
      sizeBytes: Schema.Number,
    }),
    (userId, validated) =>
      Effect.gen(function* requestStandaloneProjectUpload() {
        const uploads = yield* Uploads;
        return yield* uploads.requestProjectUpload(userId, validated);
      }),
    UploadTicketSchema
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function listProjectFilesAction(input: unknown) {
  return await runUploadAction(
    input,
    Schema.Struct({ projectId: UUIDSchema }),
    (userId, validated) =>
      Effect.gen(function* listProjectFiles() {
        const uploads = yield* Uploads;
        return yield* uploads.listProjectFiles(userId, validated.projectId);
      }),
    FinalizedFileListSchema
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function listTaskFilesAction(input: unknown) {
  return await runUploadAction(
    input,
    Schema.Struct({ taskId: UUIDSchema }),
    (userId, validated) =>
      Effect.gen(function* listTaskFiles() {
        const uploads = yield* Uploads;
        return yield* uploads.listTaskFiles(userId, validated.taskId);
      }),
    FinalizedFileListSchema
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function requestAvatarUploadAction(input: unknown) {
  return await runUploadAction(
    input,
    Schema.Struct({
      contentType: Schema.Literals(["image/jpeg", "image/png", "image/webp"]),
      sizeBytes: Schema.Number,
    }),
    (userId, validated) =>
      Effect.gen(function* requestAvatarUpload() {
        const uploads = yield* Uploads;
        return yield* uploads.requestAvatarUpload(userId, validated);
      }),
    UploadTicketSchema
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function finalizeAvatarUploadAction(input: unknown) {
  const result = await runUploadAction(
    input,
    Schema.Struct({
      idempotencyKey: IdempotencyKeySchema,
      uploadIntentId: UUIDSchema,
    }),
    (userId, validated) =>
      Effect.gen(function* finalizeAvatarUpload() {
        const uploads = yield* Uploads;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: userId,
          execute: () =>
            uploads.finalizeAvatarUpload(userId, validated.uploadIntentId),
          input: { uploadIntentId: validated.uploadIntentId },
          key: validated.idempotencyKey,
          operation: "avatar.finalize",
          resultSchema: AvatarUploadResultSchema,
        });
      })
  );
  if (result.ok) {
    revalidatePath("/settings/profile");
    revalidatePath("/settings/people");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function getAvatarDownloadUrlAction(input: unknown) {
  return await runUploadAction(
    input,
    Schema.Struct({ userId: UUIDSchema }),
    (requesterId, validated) =>
      Effect.gen(function* getAvatarDownloadUrl() {
        const uploads = yield* Uploads;
        return yield* uploads.signedAvatar(requesterId, validated.userId);
      }),
    Schema.NullOr(Schema.String)
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function finalizeUploadAction(input: unknown) {
  const result = await runUploadAction(
    input,
    Schema.Struct({
      idempotencyKey: IdempotencyKeySchema,
      uploadIntentId: UUIDSchema,
    }),
    (userId, validated) =>
      Effect.gen(function* finalizeUpload() {
        const uploads = yield* Uploads;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: userId,
          execute: () =>
            uploads.finalizeUpload(userId, validated.uploadIntentId),
          input: { uploadIntentId: validated.uploadIntentId },
          key: validated.idempotencyKey,
          operation: "upload.finalize",
          resultSchema: FinalizedFileSchema,
        });
      })
  );
  if (result.ok) {
    if (result.data.taskId) {
      revalidatePath(`/tasks/${result.data.taskId}`);
    }
    revalidatePath("/projects");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function getFileDownloadUrlAction(input: unknown) {
  const result = await runUploadAction(
    input,
    Schema.Struct({ fileId: UUIDSchema }),
    (userId, validated) =>
      Effect.gen(function* getFileDownloadUrl() {
        const uploads = yield* Uploads;
        return yield* uploads.signedDownload(userId, validated.fileId);
      }),
    Schema.String
  );
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function getFilePreviewUrlAction(input: unknown) {
  return await runUploadAction(
    input,
    Schema.Struct({ fileId: UUIDSchema }),
    (userId, validated) =>
      Effect.gen(function* getFilePreviewUrl() {
        const uploads = yield* Uploads;
        return yield* uploads.signedPreview(userId, validated.fileId);
      }),
    Schema.String
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function renameFileAction(input: unknown) {
  const result = await runUploadAction(
    input,
    Schema.Struct({
      fileId: UUIDSchema,
      fileName: Schema.String,
      idempotencyKey: IdempotencyKeySchema,
    }),
    (userId, validated) =>
      Effect.gen(function* renameUpload() {
        const uploads = yield* Uploads;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: userId,
          execute: () =>
            uploads.renameFile(userId, validated.fileId, validated.fileName),
          input: { fileId: validated.fileId, fileName: validated.fileName },
          key: validated.idempotencyKey,
          operation: "file.rename",
          resultSchema: FinalizedFileSchema,
        });
      })
  );
  if (result.ok) {
    if (result.data.taskId) {
      revalidatePath(`/tasks/${result.data.taskId}`);
    }
    revalidatePath("/projects");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function duplicateFileAction(input: unknown) {
  const result = await runUploadAction(
    input,
    Schema.Struct({
      fileId: UUIDSchema,
      idempotencyKey: IdempotencyKeySchema,
    }),
    (userId, validated) =>
      Effect.gen(function* duplicateFile() {
        const uploads = yield* Uploads;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: userId,
          execute: () => uploads.requestFileCopy(userId, validated.fileId),
          input: { fileId: validated.fileId },
          key: validated.idempotencyKey,
          operation: "file.duplicate",
          resultSchema: FileCopyResultSchema,
        });
      })
  );
  if (result.ok) {
    revalidatePath("/projects");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function removeFileAction(input: unknown) {
  const result = await runUploadAction(
    input,
    Schema.Struct({
      fileId: UUIDSchema,
      idempotencyKey: IdempotencyKeySchema,
    }),
    (userId, validated) =>
      Effect.gen(function* removeFile() {
        const uploads = yield* Uploads;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: userId,
          execute: () => uploads.removeFile(userId, validated.fileId),
          input: { fileId: validated.fileId },
          key: validated.idempotencyKey,
          operation: "file.remove",
          resultSchema: FileUndoReceiptSchema,
        });
      })
  );
  if (result.ok) {
    revalidatePath("/projects");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function undoFileRemovalAction(input: unknown) {
  const result = await runUploadAction(
    input,
    Schema.Struct({
      idempotencyKey: IdempotencyKeySchema,
      undoId: UUIDSchema,
    }),
    (userId, validated) =>
      Effect.gen(function* undoFileRemoval() {
        const uploads = yield* Uploads;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: userId,
          execute: () =>
            uploads
              .undoFileRemoval(userId, validated.undoId)
              .pipe(Effect.map(() => ({ done: true as const }))),
          input: { undoId: validated.undoId },
          key: validated.idempotencyKey,
          operation: "file.undoRemoval",
          resultSchema: DoneResultSchema,
        });
      })
  );
  if (result.ok) {
    revalidatePath("/projects");
  }
  return result;
}
