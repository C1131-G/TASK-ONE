"use server";

import { Effect, Schema } from "effect";
import { revalidatePath } from "next/cache";

import { Idempotency } from "@/src/server/core/idempotency";
import {
  IdempotencyKeySchema,
  MimeTypeSchema,
  UUIDSchema,
} from "@/src/server/core/input-schemas";
import {
  AvatarUploadResultSchema,
  FinalizedFileSchema,
  FinalizedFileListSchema,
  UploadTicketSchema,
  Uploads,
} from "@/src/server/storage/uploads-contracts";

import { runUploadAction } from "./uploads-shared";

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
      }),
    AvatarUploadResultSchema
  );
  if (result.ok) {
    revalidatePath("/settings/profile");
    revalidatePath("/settings/people");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.

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
