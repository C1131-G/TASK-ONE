import { expect, it, mock } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

interface SendCall {
  readonly options: { readonly topic?: string; readonly TTL?: number };
  readonly payload: string;
}

const sendCalls: SendCall[] = [];

class FakeWebPushError extends Error {
  readonly statusCode = 500;

  constructor(message: string) {
    super(message);
    this.name = "FakeWebPushError";
  }
}

mock.module("web-push", () => ({
  WebPushError: FakeWebPushError,
  sendNotification: (
    _subscription: unknown,
    payload: string,
    options: SendCall["options"]
  ) => {
    sendCalls.push({ options, payload });
    return Promise.resolve({});
  },
}));

process.env["VAPID_PUBLIC_KEY"] = "test-public-key";
process.env["VAPID_PRIVATE_KEY"] = "test-private-key";
process.env["VAPID_SUBJECT"] = "mailto:test@example.com";

const { PushTransport, PushTransportLive } =
  await import("../../src/server/notifications/push-transport");

it("sends a topic and a payload tag derived from the notification ID", async () => {
  const notificationId = randomUUID();

  await Effect.runPromise(
    Effect.provide(
      Effect.gen(function* sendPush() {
        const transport = yield* PushTransport;
        return yield* transport.send(
          {
            endpoint: "https://fcm.googleapis.com/example",
            keys: { auth: "auth-key-123456", p256dh: "public-key-1234567890" },
          },
          {
            actorId: randomUUID(),
            body: "Please review",
            eventType: "mention",
            notificationId,
            title: "A teammate mentioned you",
            url: "/tasks/example",
          }
        );
      }),
      PushTransportLive
    )
  );

  expect(sendCalls).toHaveLength(1);
  const [call] = sendCalls;
  const expectedTopic = notificationId.replaceAll("-", "");
  expect(call?.options.topic).toBe(expectedTopic);
  // Web Push topics are limited to 32 URL-safe characters.
  expect(expectedTopic).toHaveLength(32);
  expect(JSON.parse(call?.payload ?? "{}")).toMatchObject({
    notificationId,
    tag: notificationId,
  });
});
