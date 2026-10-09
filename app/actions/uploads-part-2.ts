"use server";

import { Effect, Schema } from "effect";
import { revalidatePath } from "next/cache";

import { DoneResultSchema, Idempotency } from "@/src/server/core/idempotency";
import {
  IdempotencyKeySchema,
  UUIDSchema,
} from "@/src/server/core/input-schemas";
import {
  FileCopyResultSchema,
  FileUndoReceiptSchema,
  FinalizedFileSchema,
  Uploads,
} from "@/src/server/storage/uploads-contracts";

import { runUploadAction } from "./uploads-shared";

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
      }),
    FinalizedFileSchema
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
      }),
    FileCopyResultSchema
  );
  if (result.ok) {
    revalidatePath("/projects");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.

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
      }),
    FileUndoReceiptSchema
  );
  if (result.ok) {
    revalidatePath("/projects");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.

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
      }),
    DoneResultSchema
  );
  if (result.ok) {
    revalidatePath("/projects");
  }
  return result;
}
