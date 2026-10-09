import { createHash, randomUUID } from "node:crypto";

import { Effect, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { isUniqueConstraintViolation } from "../core/prisma-errors";
import { KeysSchema } from "./push-contracts";
import type { PushNotifications } from "./push-contracts";
import { mapError, validateEndpoint } from "./push-internal";
import type { PushTransportApi } from "./push-transport";

const RECEIPT_WRITE_ATTEMPTS = 3;

const isUniqueViolation = isUniqueConstraintViolation;

interface ReceiptInput {
  readonly endpointHash: string;
  readonly notificationId: string;
  readonly userId: string;
}

const createReceipt = (
  input: ReceiptInput,
  attemptsLeft: number
): Effect.Effect<void, AppError> =>
  Effect.tryPromise({
    catch: (error) => error,
    try: () =>
      db.orm.public.PushDelivery.create({
        createdAt: new Date(),
        deliveredAt: new Date(),
        endpointHash: input.endpointHash,
        id: randomUUID(),
        notificationId: input.notificationId,
        userId: input.userId,
      }),
  }).pipe(
    Effect.asVoid,
    Effect.matchEffect({
      onFailure: (error) => {
        if (isUniqueViolation(error)) {
          return Effect.void;
        }
        if (attemptsLeft > 1) {
          return createReceipt(input, attemptsLeft - 1);
        }
        return Effect.fail(mapError(error));
      },
      onSuccess: () => Effect.void,
    })
  );

// The provider already accepted the push, so a receipt write failure must not
// leave the endpoint without a receipt. A unique violation means another run
// already wrote it, which is the same outcome.
const recordDelivery = (input: ReceiptInput) =>
  createReceipt(input, RECEIPT_WRITE_ATTEMPTS);
export const makeDeliver =
  (transport: PushTransportApi): PushNotifications["Service"]["deliver"] =>
  (userId, message) =>
    Effect.gen(function* deliverPushMessage() {
      const user = yield* Effect.tryPromise({
        catch: mapError,
        try: () =>
          db.orm.public.User.where({ id: userId })
            .select("deactivatedAt", "mustChangePassword")
            .first(),
      });
      if (!user || user.deactivatedAt || user.mustChangePassword) {
        return { delivered: 0, expired: 0 };
      }
      if (message.actorId === userId) {
        return { delivered: 0, expired: 0 };
      }
      const preference = yield* Effect.tryPromise({
        catch: mapError,
        try: () =>
          db.orm.public.NotificationPreference.where({
            channel: "web-push",
            enabled: false,
            eventType: message.eventType,
            userId,
          }).first(),
      });
      if (preference) {
        return { delivered: 0, expired: 0 };
      }
      const subscriptions = yield* Effect.tryPromise({
        catch: mapError,
        try: () => db.orm.public.PushSubscription.where({ userId }).all(),
      });
      let delivered = 0;
      let expired = 0;
      for (const stored of subscriptions) {
        const endpointHash = createHash("sha256")
          .update(stored.endpoint)
          .digest("hex");
        const deliveredReceipt = yield* Effect.tryPromise({
          catch: mapError,
          try: () =>
            db.orm.public.PushDelivery.where({
              endpointHash,
              notificationId: message.notificationId,
              userId,
            }).first(),
        });
        if (deliveredReceipt) {
          continue;
        }
        const decoded = yield* Effect.result(
          Effect.try({
            catch: () =>
              new AppError({
                code: "VALIDATION_FAILED",
                message: "The stored push subscription is invalid.",
              }),
            try: () => {
              validateEndpoint(stored.endpoint);
              return {
                endpoint: stored.endpoint,
                keys: Schema.decodeUnknownSync(KeysSchema)(stored.keys),
              };
            },
          })
        );
        if (decoded._tag === "Failure") {
          yield* Effect.tryPromise({
            catch: mapError,
            try: () =>
              db.orm.public.PushSubscription.where({ id: stored.id }).delete(),
          });
          expired += 1;
          continue;
        }
        const delivery = yield* Effect.result(
          transport.send(decoded.success, message)
        );
        if (delivery._tag === "Failure") {
          if (delivery.failure.code !== "NOT_FOUND") {
            return yield* Effect.fail(delivery.failure);
          }
          yield* Effect.tryPromise({
            catch: mapError,
            try: () =>
              db.orm.public.PushSubscription.where({ id: stored.id }).delete(),
          });
          expired += 1;
        } else {
          yield* recordDelivery({
            endpointHash,
            notificationId: message.notificationId,
            userId,
          });
          delivered += 1;
        }
      }
      return { delivered, expired };
    });
