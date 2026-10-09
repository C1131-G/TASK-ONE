import type { Effect } from "effect";
import { Context, Schema } from "effect";

import type { AppError } from "../core/action-result";

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

export const UploadTicketSchema = Schema.Struct({
  requiredHeaders: Schema.Struct({
    "content-type": Schema.String,
    "if-none-match": Schema.Literal("*"),
  }),
  uploadIntentId: Schema.String,
  uploadUrl: Schema.String,
});

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

export const FinalizedFileListSchema = Schema.Array(FinalizedFileSchema);

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
