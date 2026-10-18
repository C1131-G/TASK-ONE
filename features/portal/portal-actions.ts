"use server";

/* eslint-disable func-style -- Next Server Actions require named declarations. */

import { Effect, Schema, Layer } from "effect";
import { revalidatePath } from "next/cache";

import {
  bugIdOf,
  revalidatePortal,
  withKey,
} from "@/features/portal/portal-action-helpers";
import {
  runPortalAction,
  toPortalActor,
} from "@/features/portal/portal-action-runner";
import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import {
  DoneResultSchema,
  Idempotency,
  IdempotencyLive,
} from "@/src/server/core/idempotency";
import {
  UUIDSchema,
  IdempotencyKeySchema,
  MimeTypeSchema,
} from "@/src/server/core/input-schemas";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import {
  PushNotifications,
  PushNotificationsLive,
} from "@/src/server/notifications/push";
import { PushTransportLive } from "@/src/server/notifications/push-transport";
import { Notifications } from "@/src/server/notifications/service";
import {
  PortalBugReceiptSchema,
  PortalBugs,
  PortalCommentSchema,
} from "@/src/server/portal/portal-contracts";
import {
  ClientBugVersionInputSchema,
  ClientCommentInputSchema,
  ConfirmClientFixInputSchema,
  EditClientBugInputSchema,
  RateClientBugInputSchema,
  ReopenClientFixInputSchema,
  SubmitClientBugInputSchema,
  AttachClientFileInputSchema,
} from "@/src/server/portal/portal-input-contracts";
import {
  FinalizedFileSchema,
  UploadTicketSchema,
  Uploads,
} from "@/src/server/storage/uploads-contracts";

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

export async function confirmClientFixAction(input: unknown) {
  const result = await runPortalAction(
    input,
    withKey(ConfirmClientFixInputSchema),
    (user, validated) =>
      Effect.gen(function* confirmClientFix() {
        const bugs = yield* PortalBugs;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...fixInput } = validated;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () => bugs.confirmFix(toPortalActor(user), fixInput),
          input: fixInput,
          key: idempotencyKey,
          operation: "portal.bug.confirm",
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

export async function reopenClientFixAction(input: unknown) {
  const result = await runPortalAction(
    input,
    withKey(ReopenClientFixInputSchema),
    (user, validated) =>
      Effect.gen(function* reopenClientFix() {
        const bugs = yield* PortalBugs;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...fixInput } = validated;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () => bugs.reopenFix(toPortalActor(user), fixInput),
          input: fixInput,
          key: idempotencyKey,
          operation: "portal.bug.reopen",
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

export async function rateClientBugAction(input: unknown) {
  const result = await runPortalAction(
    input,
    withKey(RateClientBugInputSchema),
    (user, validated) =>
      Effect.gen(function* rateClientBug() {
        const bugs = yield* PortalBugs;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...ratingInput } = validated;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () =>
            bugs
              .rateBug(toPortalActor(user), ratingInput)
              .pipe(Effect.map(() => ({ done: true as const }))),
          input: ratingInput,
          key: idempotencyKey,
          operation: "portal.bug.rate",
          resultSchema: DoneResultSchema,
        });
      }),
    DoneResultSchema
  );
  if (result.ok) {
    revalidatePortal(bugIdOf(input));
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
    revalidatePortal(bugIdOf(input));
  }
  return result;
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

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function registerPortalPushAction(input: unknown) {
  return await runServerAction(
    input,
    Schema.Struct({
      endpoint: Schema.String,
      idempotencyKey: IdempotencyKeySchema,
      keys: Schema.Struct({ auth: Schema.String, p256dh: Schema.String }),
      userAgent: Schema.NullOr(Schema.String),
    }),
    (validated) =>
      Effect.gen(function* registerPortalPush() {
        const sessions = yield* AuthSession;
        const user = yield* sessions.requirePortalAccess(
          yield* requestHeadersOrFail
        );
        const push = yield* PushNotifications;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...subscription } = validated;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () =>
            push
              .register(user.id, subscription)
              .pipe(Effect.map(() => ({ done: true as const }))),
          input: subscription,
          key: idempotencyKey,
          operation: "portal.push.register",
          resultSchema: DoneResultSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(Layer.provide(PushNotificationsLive, PushTransportLive)),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    DoneResultSchema
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function removePortalPushAction(input: unknown) {
  return await runServerAction(
    input,
    Schema.Struct({
      endpoint: Schema.String,
      idempotencyKey: IdempotencyKeySchema,
    }),
    (validated) =>
      Effect.gen(function* removePortalPush() {
        const sessions = yield* AuthSession;
        const user = yield* sessions.requirePortalAccess(
          yield* requestHeadersOrFail
        );
        const push = yield* PushNotifications;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () =>
            push
              .unregister(user.id, validated.endpoint)
              .pipe(Effect.map(() => ({ done: true as const }))),
          input: { endpoint: validated.endpoint },
          key: validated.idempotencyKey,
          operation: "portal.push.unregister",
          resultSchema: DoneResultSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(Layer.provide(PushNotificationsLive, PushTransportLive)),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    DoneResultSchema
  );
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
