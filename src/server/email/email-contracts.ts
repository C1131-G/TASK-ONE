import type { Effect } from "effect";
import { Context, Schema } from "effect";

import type { AppError } from "../core/action-result";
import { EMAIL_EVENT_TYPES } from "./email-events";

export {
  EMAIL_CHANNEL,
  EMAIL_EVENT_TYPES,
  isEmailEventType,
} from "./email-events";
export type { EmailEventType } from "./email-events";

export const EmailSettingsSchema = Schema.Struct({ digest: Schema.Boolean });
export type EmailSettings = typeof EmailSettingsSchema.Type;

export const EmailJobPayloadSchema = Schema.Struct({
  body: Schema.String,
  eventType: Schema.Literals(EMAIL_EVENT_TYPES),
  notificationId: Schema.String.check(Schema.isUUID()),
  title: Schema.String,
  url: Schema.String.check(
    Schema.makeFilter((url) =>
      url.startsWith("/") && !url.startsWith("//")
        ? undefined
        : "Email links must be local paths."
    )
  ),
  userId: Schema.String,
});
export type EmailJobPayload = typeof EmailJobPayloadSchema.Type;

export const EMAIL_DELIVERY_JOB = "notifications.deliver-email";
export const EMAIL_DIGEST_JOB = "notifications.email-digest";

export class EmailNotifications extends Context.Service<
  EmailNotifications,
  {
    /** "skipped" means the person no longer wants it or it already went out. */
    readonly deliverNotification: (
      input: EmailJobPayload
    ) => Effect.Effect<"sent" | "logged" | "skipped", AppError>;
    readonly sendDigests: (
      scheduledAt: Date
    ) => Effect.Effect<{ readonly usersEmailed: number }, AppError>;
    readonly getSettings: (
      userId: string
    ) => Effect.Effect<EmailSettings, AppError>;
    readonly setDigest: (
      userId: string,
      digest: boolean
    ) => Effect.Effect<void, AppError>;
    /** Turns off every email for the person. Used by the footer link. */
    readonly unsubscribe: (userId: string) => Effect.Effect<void, AppError>;
  }
>()("metsys/server/EmailNotifications") {}
