import { Schema } from "effect";

import { AppError } from "../core/action-result";
import { FinalizedFileSchema } from "./uploads-contracts";
import type { FinalizedFile } from "./uploads-contracts";

export const toFinalizedFile = (file: {
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
    copyState: Schema.decodeUnknownSync(FinalizedFileSchema.fields.copyState)(
      file.copyState
    ),
    createdAt: file.createdAt.toISOString(),
    id: file.id,
    originalName: file.originalName,
    projectId: file.projectId,
    sizeBytes: Number(file.sizeBytes),
    taskId: file.taskId,
    uploadedById: file.uploadedById,
  };
};
