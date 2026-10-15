"use server";

/* eslint-disable func-style -- Next Server Actions require named declarations. */

import { Effect, Schema } from "effect";
import { revalidatePath } from "next/cache";

import { DoneResultSchema, Idempotency } from "@/src/server/core/idempotency";
import {
  IdempotencyKeySchema,
  UUIDSchema,
  MimeTypeSchema,
} from "@/src/server/core/input-schemas";
import { Notifications } from "@/src/server/notifications/service";
import {
  AttachClientFileInputSchema,
  ClientBugVersionInputSchema,
  ClientCommentInputSchema,
  EditClientBugInputSchema,
  PortalBugReceiptSchema,
  PortalBugs,
  PortalCommentSchema,
  SubmitClientBugInputSchema,
} from "@/src/server/portal/portal-contracts";
import {
  FinalizedFileSchema,
  UploadTicketSchema,
  Uploads,
} from "@/src/server/storage/uploads-contracts";

import { runPortalAction, toPortalActor } from "./portal-action-runner";

const withKey = <Fields extends Schema.Struct.Fields>(
  schema: Schema.Struct<Fields>
) => Schema.Struct({ ...schema.fields, idempotencyKey: IdempotencyKeySchema });

const revalidatePortal = (bugId?: string) => {
  revalidatePath("/portal");
  revalidatePath("/bugs");
  if (bugId) {
    revalidatePath(`/portal/bugs/${bugId}`);
  }
};

export async function submitClientBugAction(input: unknown) {
  const result = await runPortalAction(
    input,
    withKey(SubmitClientBugInputSchema),
    (user, validated) =>
      Effect.gen(function* submitClientBug() {
        const bugs = yield* PortalBugs;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...bugInput } = validated;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () => bugs.submitBug(toPortalActor(user), bugInput),
          input: bugInput,
          key: idempotencyKey,
          operation: "portal.bug.submit",
          resultSchema: PortalBugReceiptSchema,
        });
      }),
    PortalBugReceiptSchema
  );
  if (result.ok) {
    revalidatePortal(result.data.bugId);
  }
  return result;
}

export async function editClientBugAction(input: unknown) {
  const result = await runPortalAction(
    input,
    withKey(EditClientBugInputSchema),
    (user, validated) =>
      Effect.gen(function* editClientBug() {
        const bugs = yield* PortalBugs;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...bugInput } = validated;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () => bugs.editBug(toPortalActor(user), bugInput),
          input: bugInput,
          key: idempotencyKey,
          operation: "portal.bug.edit",
          resultSchema: PortalBugReceiptSchema,
        });
      }),
    PortalBugReceiptSchema
  );
  if (result.ok) {
    revalidatePortal(result.data.bugId);
  }
  return result;
}

export async function withdrawClientBugAction(input: unknown) {
  const result = await runPortalAction(
    input,
    withKey(ClientBugVersionInputSchema),
    (user, validated) =>
      Effect.gen(function* withdrawClientBug() {
        const bugs = yield* PortalBugs;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...bugInput } = validated;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () => bugs.withdrawBug(toPortalActor(user), bugInput),
          input: bugInput,
          key: idempotencyKey,
          operation: "portal.bug.withdraw",
          resultSchema: PortalBugReceiptSchema,
        });
      }),
    PortalBugReceiptSchema
  );
  if (result.ok) {
    revalidatePortal(result.data.bugId);
  }
  return result;
}

export async function addClientCommentAction(input: unknown) {
  const result = await runPortalAction(
    input,
    withKey(ClientCommentInputSchema),
    (user, validated) =>
      Effect.gen(function* addClientComment() {
        const bugs = yield* PortalBugs;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...commentInput } = validated;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () => bugs.addComment(toPortalActor(user), commentInput),
          input: commentInput,
          key: idempotencyKey,
          operation: "portal.bug.comment",
          resultSchema: PortalCommentSchema,
        });
      }),
    PortalCommentSchema
  );
  if (result.ok) {
    revalidatePortal();
  }
  return result;
}

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
    revalidatePortal();
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
    revalidatePortal();
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
    Schema.String
  );
}

export async function markPortalNotificationReadAction(input: unknown) {
  const result = await runPortalAction(
    input,
    Schema.Struct({ notificationId: UUIDSchema }),
    (user, validated) =>
      Effect.gen(function* markPortalNotificationRead() {
        const notifications = yield* Notifications;
        yield* notifications.markRead(user.id, validated.notificationId);
        return { done: true as const };
      }),
    DoneResultSchema
  );
  if (result.ok) {
    revalidatePath("/portal/notifications");
  }
  return result;
}

export async function markAllPortalNotificationsReadAction(input: unknown) {
  const result = await runPortalAction(
    input,
    Schema.Struct({}),
    (user) =>
      Effect.gen(function* markAllPortalNotificationsRead() {
        const notifications = yield* Notifications;
        yield* notifications.markAllRead(user.id);
        return { done: true as const };
      }),
    DoneResultSchema
  );
  if (result.ok) {
    revalidatePath("/portal/notifications");
  }
  return result;
}
