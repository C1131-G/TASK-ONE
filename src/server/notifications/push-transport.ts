import { Context, Effect, Layer } from "effect";
import { sendNotification, WebPushError } from "web-push";
import type { PushSubscription as WebPushSubscription } from "web-push";

import { AppError } from "../core/action-result";

export interface PushMessage {
  readonly notificationId: string;
  readonly actorId: string;
  readonly eventType: "mention" | "assignment" | "comment" | "update" | "due";
  readonly title: string;
  readonly body: string;
  readonly url: string;
}

export interface PushTransportApi {
  readonly send: (
    subscription: WebPushSubscription,
    message: PushMessage
  ) => Effect.Effect<"delivered", AppError>;
}

export class PushTransport extends Context.Service<
  PushTransport,
  PushTransportApi
>()("metsys/server/PushTransport") {}

const makePushTransport = (): PushTransportApi => ({
  send: (subscription, message) =>
    Effect.tryPromise({
      catch: (error) =>
        new AppError({
          code:
            error instanceof WebPushError &&
            (error.statusCode === 404 || error.statusCode === 410)
              ? "NOT_FOUND"
              : "UNAVAILABLE",
          message:
            error instanceof WebPushError &&
            (error.statusCode === 404 || error.statusCode === 410)
              ? "The push endpoint has expired."
              : "The push provider could not deliver the notification.",
        }),
      try: async () => {
        const publicKey = process.env["VAPID_PUBLIC_KEY"];
        const privateKey = process.env["VAPID_PRIVATE_KEY"];
        const subject = process.env["VAPID_SUBJECT"];
        if (!publicKey || !privateKey || !subject) {
          throw new AppError({
            code: "UNAVAILABLE",
            message: "Web push is not configured on this server.",
          });
        }
        // The topic and tag are derived from the notification ID so a resend
        // after a failed receipt write replaces the first push instead of
        // showing a duplicate. The service worker must pass `tag` to
        // showNotification for this to take effect.
        const payload = { ...message, tag: message.notificationId };
        await sendNotification(subscription, JSON.stringify(payload), {
          TTL: 60,
          topic: message.notificationId.replaceAll("-", ""),
          urgency: "normal",
          vapidDetails: { privateKey, publicKey, subject },
        });
        return "delivered" as const;
      },
    }),
});

export const PushTransportLive = Layer.succeed(
  PushTransport,
  PushTransport.of(makePushTransport())
);
