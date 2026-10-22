import { Effect, Layer, Schema } from "effect";

import { db } from "@/src/prisma/db";

import {
  AUTOMATION_OVERDUE_SWEEP_JOB,
  AUTOMATION_RULE_JOB,
} from "../automation/automation-contracts";
import { decodeAutomationJob } from "../automation/automation-job";
import { sweepOverdueTasks } from "../automation/automation-overdue";
import { runAutomationEvent } from "../automation/automation-runner";
import { AppError } from "../core/action-result";
import {
  EMAIL_DELIVERY_JOB,
  EMAIL_DIGEST_JOB,
  EmailJobPayloadSchema,
} from "../email/email-contracts";
import {
  EmailNotifications,
  EmailNotificationsLive,
} from "../email/email-notifications";
import { MailTransportLive } from "../email/mail-transport";
import {
  PushNotifications,
  PushNotificationsLive,
} from "../notifications/push";
import { Notifications, NotificationsLive } from "../notifications/service";
import { Storage } from "../storage/storage";
import { UploadsLive } from "../storage/uploads";
import { Uploads } from "../storage/uploads-contracts";
import { WEBHOOK_DELIVERY_JOB } from "../webhooks/webhook-contracts";
import { deliverWebhook, liveDeliveryDeps } from "../webhooks/webhook-delivery";
import { decodeWebhookJob } from "../webhooks/webhook-job";
import { SLA_SWEEP_JOB } from "../work/bug-sla";
import { runSlaSweep } from "../work/bug-sla-sweep";
import {
  autoCloseAwaitingClient,
  autoCloseNeedsInfo,
  remindNeedsInfo,
} from "../work/bug-workflow-client-jobs";
import {
  AWAITING_CLIENT_AUTOCLOSE_JOB,
  NEEDS_INFO_AUTOCLOSE_JOB,
  NEEDS_INFO_REMINDER_JOB,
} from "../work/bug-workflow-client-support";
import {
  UNPICKED_REMINDER_JOB,
  remindUnpickedClientBug,
} from "../work/bug-workflow-pick";
import { DATA_RETENTION_JOB, purgeExpiredData } from "./data-retention";
import { JobHandlers } from "./job-handlers";
import type { JsonValue } from "./job-handlers";

const ISO_DATE_LENGTH = 10;
const EmptyPayloadSchema = Schema.Struct({});
const decodeEmptyPayload = (payload: JsonValue, jobLabel: string) =>
  Effect.try({
    catch: () =>
      new AppError({
        code: "VALIDATION_FAILED",
        message: `The ${jobLabel} job payload is invalid.`,
      }),
    try: () => Schema.decodeUnknownSync(EmptyPayloadSchema)(payload),
  });
const DailyDueSummaryPayloadSchema = Schema.Struct({
  scheduledAt: Schema.DateFromString,
});
const DeleteAvatarPayloadSchema = Schema.Struct({
  objectKey: Schema.String.check(
    Schema.makeFilter((objectKey) =>
      objectKey.startsWith("company/avatars/")
        ? undefined
        : "Only private avatar objects can be removed by this job."
    )
  ),
});
const DeleteClientLogoPayloadSchema = Schema.Struct({
  objectKey: Schema.String.check(
    Schema.makeFilter((objectKey) =>
      objectKey.startsWith("company/client-logos/") &&
      !objectKey.includes("\\") &&
      !objectKey.split("/").some((part) => part === "." || part === "..")
        ? undefined
        : "Only private client logo objects can be removed by this job."
    )
  ),
});
const FileCopyPayloadSchema = Schema.Struct({
  sourceFileId: Schema.String.check(Schema.isUUID()),
  sourceKey: Schema.String.check(
    Schema.makeFilter((key) =>
      key.startsWith("company/") &&
      !key.includes("\\") &&
      !key.split("/").some((part) => part === "." || part === "..")
        ? undefined
        : "Only private company objects can be copied."
    )
  ),
  targetFileId: Schema.String.check(Schema.isUUID()),
  targetKey: Schema.String.check(
    Schema.makeFilter((key) =>
      key.startsWith("company/files/") &&
      !key.includes("\\") &&
      !key.split("/").some((part) => part === "." || part === "..")
        ? undefined
        : "Copies must target private file storage."
    )
  ),
});
const ClientWaitPayloadSchema = Schema.Struct({
  bugId: Schema.String.check(Schema.isUUID()),
  since: Schema.DateFromString,
});
const clientWaitJobs = {
  [AWAITING_CLIENT_AUTOCLOSE_JOB]: autoCloseAwaitingClient,
  [NEEDS_INFO_AUTOCLOSE_JOB]: autoCloseNeedsInfo,
  [NEEDS_INFO_REMINDER_JOB]: remindNeedsInfo,
} as const;
const UnpickedReminderPayloadSchema = Schema.Struct({
  bugId: Schema.String.check(Schema.isUUID()),
});
const PushDeliveryPayloadSchema = Schema.Struct({
  actorId: Schema.String,
  body: Schema.String,
  eventType: Schema.Literals([
    "mention",
    "assignment",
    "comment",
    "update",
    "due",
    "client_bug",
    "status",
    "sla",
  ]),
  notificationId: Schema.String.check(Schema.isUUID()),
  title: Schema.String,
  url: Schema.String.check(
    Schema.makeFilter((url) =>
      url.startsWith("/") ? undefined : "Push links must be local paths."
    )
  ),
  userId: Schema.String,
});

export const JobHandlersLive = Layer.effect(
  JobHandlers,
  Effect.gen(function* createJobHandlers() {
    const uploads = yield* Uploads;
    const storage = yield* Storage;
    const push = yield* PushNotifications;
    const notifications = yield* Notifications;
    const email = yield* EmailNotifications;
    return JobHandlers.of({
      handle: (kind, payload) => {
        if (kind === "storage.cleanup-expired-uploads") {
          return decodeEmptyPayload(payload, "upload cleanup").pipe(
            Effect.flatMap(() => uploads.cleanupExpiredUploads()),
            Effect.asVoid
          );
        }
        if (kind === DATA_RETENTION_JOB) {
          return decodeEmptyPayload(payload, "data-retention").pipe(
            Effect.flatMap(() => purgeExpiredData({ now: new Date() })),
            Effect.asVoid
          );
        }
        if (kind === "storage.delete-avatar") {
          return Effect.try({
            catch: () =>
              new AppError({
                code: "VALIDATION_FAILED",
                message: "The avatar cleanup job payload is invalid.",
              }),
            try: () =>
              Schema.decodeUnknownSync(DeleteAvatarPayloadSchema)(payload),
          }).pipe(
            Effect.flatMap(({ objectKey }) => storage.deleteObject(objectKey))
          );
        }
        if (kind === "storage.delete-client-logo") {
          return Effect.try({
            catch: () =>
              new AppError({
                code: "VALIDATION_FAILED",
                message: "The client logo cleanup job payload is invalid.",
              }),
            try: () =>
              Schema.decodeUnknownSync(DeleteClientLogoPayloadSchema)(payload),
          }).pipe(
            Effect.flatMap(({ objectKey }) => storage.deleteObject(objectKey))
          );
        }
        if (kind === "storage.copy-file") {
          return Effect.try({
            catch: () =>
              new AppError({
                code: "VALIDATION_FAILED",
                message: "The file copy job payload is invalid.",
              }),
            try: () => Schema.decodeUnknownSync(FileCopyPayloadSchema)(payload),
          }).pipe(
            Effect.flatMap(
              ({ sourceFileId, targetFileId, sourceKey, targetKey }) =>
                uploads.processFileCopy(
                  sourceFileId,
                  targetFileId,
                  sourceKey,
                  targetKey
                )
            )
          );
        }
        if (kind in clientWaitJobs) {
          const run = clientWaitJobs[kind as keyof typeof clientWaitJobs];
          return Effect.try({
            catch: () =>
              new AppError({
                code: "VALIDATION_FAILED",
                message: "The client follow-up job payload is invalid.",
              }),
            try: () =>
              Schema.decodeUnknownSync(ClientWaitPayloadSchema)(payload),
          }).pipe(
            Effect.flatMap(({ bugId, since }) =>
              Effect.tryPromise({
                catch: () =>
                  new AppError({
                    code: "UNAVAILABLE",
                    message: "The client follow-up could not be completed.",
                  }),
                try: () =>
                  db.transaction((transaction) =>
                    run(transaction, bugId, since)
                  ),
              })
            ),
            Effect.asVoid
          );
        }
        if (kind === SLA_SWEEP_JOB) {
          return Effect.tryPromise({
            catch: () =>
              new AppError({
                code: "UNAVAILABLE",
                message: "The SLA sweep could not be completed.",
              }),
            try: () =>
              db.transaction((transaction) =>
                runSlaSweep(transaction, new Date())
              ),
          }).pipe(Effect.asVoid);
        }
        if (kind === UNPICKED_REMINDER_JOB) {
          return Effect.try({
            catch: () =>
              new AppError({
                code: "VALIDATION_FAILED",
                message: "The unpicked-bug reminder payload is invalid.",
              }),
            try: () =>
              Schema.decodeUnknownSync(UnpickedReminderPayloadSchema)(payload),
          }).pipe(
            Effect.flatMap(({ bugId }) =>
              Effect.tryPromise({
                catch: () =>
                  new AppError({
                    code: "UNAVAILABLE",
                    message: "The unpicked-bug reminder could not be sent.",
                  }),
                try: () =>
                  db.transaction((transaction) =>
                    remindUnpickedClientBug(transaction, bugId)
                  ),
              })
            ),
            Effect.asVoid
          );
        }
        if (kind === "notifications.deliver-push") {
          return Effect.try({
            catch: () =>
              new AppError({
                code: "VALIDATION_FAILED",
                message: "The push delivery job payload is invalid.",
              }),
            try: () =>
              Schema.decodeUnknownSync(PushDeliveryPayloadSchema)(payload),
          }).pipe(
            Effect.flatMap(({ userId, ...message }) =>
              push.deliver(userId, message)
            ),
            Effect.asVoid
          );
        }
        if (kind === EMAIL_DELIVERY_JOB) {
          return Effect.try({
            catch: () =>
              new AppError({
                code: "VALIDATION_FAILED",
                message: "The email delivery job payload is invalid.",
              }),
            try: () => Schema.decodeUnknownSync(EmailJobPayloadSchema)(payload),
          }).pipe(
            Effect.flatMap((message) => email.deliverNotification(message)),
            Effect.asVoid
          );
        }
        if (kind === EMAIL_DIGEST_JOB) {
          return Effect.try({
            catch: () =>
              new AppError({
                code: "VALIDATION_FAILED",
                message: "The email digest job payload is invalid.",
              }),
            try: () =>
              Schema.decodeUnknownSync(DailyDueSummaryPayloadSchema)(payload),
          }).pipe(
            Effect.flatMap(({ scheduledAt }) => email.sendDigests(scheduledAt)),
            Effect.asVoid
          );
        }
        if (kind === AUTOMATION_OVERDUE_SWEEP_JOB) {
          return Effect.try({
            catch: () =>
              new AppError({
                code: "VALIDATION_FAILED",
                message: "The overdue sweep job payload is invalid.",
              }),
            try: () =>
              Schema.decodeUnknownSync(DailyDueSummaryPayloadSchema)(payload),
          }).pipe(
            Effect.flatMap(({ scheduledAt }) =>
              Effect.tryPromise({
                catch: () =>
                  new AppError({
                    code: "UNAVAILABLE",
                    message: "The overdue sweep could not be completed.",
                  }),
                try: () =>
                  sweepOverdueTasks(
                    scheduledAt.toISOString().slice(0, ISO_DATE_LENGTH),
                    scheduledAt
                  ),
              })
            ),
            Effect.asVoid
          );
        }
        if (kind === AUTOMATION_RULE_JOB) {
          return decodeAutomationJob(payload).pipe(
            Effect.flatMap((event) =>
              Effect.tryPromise({
                catch: () =>
                  new AppError({
                    code: "UNAVAILABLE",
                    message: "The automation rules could not be run.",
                  }),
                try: () => runAutomationEvent(event),
              })
            )
          );
        }
        if (kind === WEBHOOK_DELIVERY_JOB) {
          return decodeWebhookJob(payload).pipe(
            Effect.flatMap(({ deliveryId }) =>
              deliverWebhook(deliveryId, liveDeliveryDeps())
            )
          );
        }
        if (kind === "notifications.daily-due-summary") {
          return Effect.try({
            catch: () =>
              new AppError({
                code: "VALIDATION_FAILED",
                message: "The due-summary job payload is invalid.",
              }),
            try: () =>
              Schema.decodeUnknownSync(DailyDueSummaryPayloadSchema)(payload),
          }).pipe(
            Effect.flatMap(({ scheduledAt }) =>
              notifications.sendDailyDueSummaries(scheduledAt)
            ),
            Effect.asVoid
          );
        }
        return Effect.fail(
          new AppError({
            code: "NOT_FOUND",
            message: `No worker handles the ${kind} job yet.`,
          })
        );
      },
    });
  })
)
  .pipe(Layer.provide(UploadsLive))
  .pipe(Layer.provide(NotificationsLive))
  .pipe(Layer.provide(PushNotificationsLive))
  .pipe(Layer.provide(EmailNotificationsLive))
  .pipe(Layer.provide(MailTransportLive));
