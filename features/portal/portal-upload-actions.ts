"use server";

/* eslint-disable func-style -- Next Server Actions require named declarations. */

import { Effect, Schema } from "effect";

import {
  bugIdOf,
  revalidatePortal,
} from "@/features/portal/portal-action-helpers";
import {
  runPortalAction,
  toPortalActor,
} from "@/features/portal/portal-action-runner";
import { DoneResultSchema, Idempotency } from "@/src/server/core/idempotency";
import {
  UUIDSchema,
  IdempotencyKeySchema,
  MimeTypeSchema,
} from "@/src/server/core/input-schemas";
import { PortalBugs } from "@/src/server/portal/portal-contracts";
import { AttachClientFileInputSchema } from "@/src/server/portal/portal-input-contracts";
import {
  FinalizedFileSchema,
  UploadTicketSchema,
  Uploads,
} from "@/src/server/storage/uploads-contracts";

// Attachments upload straight to storage. The client asks for a ticket for one
// of its bugs, uploads, finalizes, then links the file to the bug.
export async function requestPortalUploadAction(input: unknown) {
  return await runPortalAction(
    input,
    Schema.Struct({
      bugId: UUIDSchema,
      contentType: MimeTypeSchema,
      fileName: Schema.String,
      sizeBytes: Schema.Number,
    }),
    (user, validated) =>
      Effect.gen(function* requestPortalUpload() {
        const bugs = yield* PortalBugs;
        const uploads = yield* Uploads;
        const taskId = yield* bugs.taskIdForBug(
          toPortalActor(user),
          validated.bugId
        );
        return yield* uploads.requestTaskUpload(user.id, {
          contentType: validated.contentType,
          fileName: validated.fileName,
          sizeBytes: validated.sizeBytes,
          taskId,
        });
      }),
    UploadTicketSchema
  );
}

export async function finalizePortalUploadAction(input: unknown) {
  const result = await runPortalAction(
    input,
    Schema.Struct({
      bugId: UUIDSchema,
      idempotencyKey: IdempotencyKeySchema,
      uploadIntentId: UUIDSchema,
    }),
    (user, validated) =>
      Effect.gen(function* finalizePortalUpload() {
        const bugs = yield* PortalBugs;
        const uploads = yield* Uploads;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () =>
            Effect.gen(function* finalizeAndAttach() {
              const file = yield* uploads.finalizeUpload(
                user.id,
                validated.uploadIntentId
              );
              yield* bugs.attachFile(toPortalActor(user), {
                bugId: validated.bugId,
                fileId: file.id,
              });
              return file;
            }),
          input: {
            bugId: validated.bugId,
            uploadIntentId: validated.uploadIntentId,
          },
          key: validated.idempotencyKey,
          operation: "portal.upload.finalize",
          resultSchema: FinalizedFileSchema,
        });
      }),
    FinalizedFileSchema
  );
  if (result.ok) {
    revalidatePortal(bugIdOf(input));
  }
  return result;
}

export async function attachClientFileAction(input: unknown) {
  const result = await runPortalAction(
    input,
    AttachClientFileInputSchema,
    (user, validated) =>
      Effect.gen(function* attachClientFile() {
        const bugs = yield* PortalBugs;
        yield* bugs.attachFile(toPortalActor(user), validated);
        return { done: true as const };
      }),
    DoneResultSchema
  );
  if (result.ok) {
    revalidatePortal(bugIdOf(input));
  }
  return result;
}

// The storage layer re-checks that the file is one of this company's.
export async function getPortalFileUrlAction(input: unknown) {
  return await runPortalAction(
    input,
    Schema.Struct({
      disposition: Schema.Literals(["download", "preview"]),
      fileId: UUIDSchema,
    }),
    (user, validated) =>
      Effect.gen(function* getPortalFileUrl() {
        const uploads = yield* Uploads;
        return validated.disposition === "preview"
          ? yield* uploads.signedPreview(user.id, validated.fileId)
          : yield* uploads.signedDownload(user.id, validated.fileId);
      }),
    Schema.String,
    // Reading an attachment is safe in an admin's read-only preview.
    { preview: true }
  );
}
