import { Effect, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../../core/action-result";
import { PreviewContentTypeSchema } from "../../storage/uploads-internal";

const isPreviewable = Schema.is(PreviewContentTypeSchema);

const FALLBACK_CONTENT_TYPE = "application/octet-stream";

export interface AttachmentSummary {
  readonly contentType: string;
  readonly createdAt: string;
  readonly id: string;
  readonly name: string;
  readonly previewable: boolean;
  readonly sizeBytes: number;
  readonly taskId: string | null;
  readonly uploadedBy: { readonly id: string; readonly name: string };
}

const toSummary = (file: {
  readonly contentType: string | null;
  readonly createdAt: Date;
  readonly id: string;
  readonly originalName: string;
  readonly sizeBytes: bigint;
  readonly taskId: string | null;
  readonly uploadedBy: { readonly id: string; readonly name: string };
}): AttachmentSummary => {
  const contentType = file.contentType ?? FALLBACK_CONTENT_TYPE;
  return {
    contentType,
    createdAt: file.createdAt.toISOString(),
    id: file.id,
    name: file.originalName,
    previewable: isPreviewable(contentType),
    sizeBytes: Number(file.sizeBytes),
    taskId: file.taskId,
    uploadedBy: { id: file.uploadedBy.id, name: file.uploadedBy.name },
  };
};

// The files with these ids as the app lists them, oldest first. Callers decide
// which ids a person may see; this only shapes them.
export const summarizeFiles = (
  fileIds: readonly string[]
): Effect.Effect<readonly AttachmentSummary[], AppError> =>
  Effect.tryPromise({
    catch: () =>
      new AppError({
        code: "UNAVAILABLE",
        message: "The files could not be loaded.",
      }),
    try: async () => {
      if (fileIds.length === 0) {
        return [];
      }
      const files = await db.orm.public.FileAsset.include("uploadedBy")
        .where((file) => file.id.in([...fileIds]))
        .orderBy((file) => file.createdAt.asc())
        .all();
      return files.map(toSummary);
    },
  });

export const summarizeFile = (
  fileId: string
): Effect.Effect<AttachmentSummary, AppError> =>
  Effect.flatMap(summarizeFiles([fileId]), ([file]) =>
    file
      ? Effect.succeed(file)
      : Effect.fail(
          new AppError({
            code: "NOT_FOUND",
            message: "The file was not found.",
          })
        )
  );
