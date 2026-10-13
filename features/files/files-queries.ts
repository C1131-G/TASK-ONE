import "server-only";
import { Effect, Schema } from "effect";

import { UUIDSchema } from "@/src/server/core/input-schemas";
import {
  FinalizedFileListSchema,
  Uploads,
} from "@/src/server/storage/uploads-contracts";

import { runUploadAction } from "./actions/upload-action-runner";

export const listProjectFiles = async (input: unknown) =>
  await runUploadAction(
    input,
    Schema.Struct({ projectId: UUIDSchema }),
    (userId, validated) =>
      Effect.gen(function* listProjectFilesProgram() {
        const uploads = yield* Uploads;
        return yield* uploads.listProjectFiles(userId, validated.projectId);
      }),
    FinalizedFileListSchema
  );

export const getAvatarDownloadUrl = async (input: unknown) =>
  await runUploadAction(
    input,
    Schema.Struct({ userId: UUIDSchema }),
    (requesterId, validated) =>
      Effect.gen(function* getAvatarDownloadUrlProgram() {
        const uploads = yield* Uploads;
        return yield* uploads.signedAvatar(requesterId, validated.userId);
      }),
    Schema.NullOr(Schema.String)
  );
