import { createHash, randomUUID } from "node:crypto";
import { isIP } from "node:net";

import { Context, Effect, Layer, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { PushMessage, PushTransportApi } from "./push-transport";
import { PushTransport } from "./push-transport";

const KeysSchema = Schema.Struct({
  auth: Schema.String.check(Schema.isMinLength(8), Schema.isMaxLength(256)),
  p256dh: Schema.String.check(Schema.isMinLength(16), Schema.isMaxLength(256)),
});
const PushInputSchema = Schema.Struct({
  endpoint: Schema.String.check(Schema.isMaxLength(2048)),
  keys: KeysSchema,
  userAgent: Schema.NullOr(Schema.String.check(Schema.isMaxLength(500))),
});

export type PushInput = typeof PushInputSchema.Type;

export interface DeliveryResult {
  readonly delivered: number;
  readonly expired: number;
}

export class PushNotifications extends Context.Service<
  PushNotifications,
  {
    readonly register: (
      userId: string,
      input: PushInput
    ) => Effect.Effect<void, AppError>;
    readonly unregister: (
      userId: string,
      endpoint: string
    ) => Effect.Effect<void, AppError>;
    readonly deliver: (
      userId: string,
      message: PushMessage
    ) => Effect.Effect<DeliveryResult, AppError>;
  }
>()("metsys/server/PushNotifications") {}

const mapError = (error: unknown): AppError =>
  error instanceof AppError
    ? error
    : new AppError({
        code: "UNAVAILABLE",
        message: "The push notification could not be processed.",
      });

const RECEIPT_WRITE_ATTEMPTS = 3;

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "P2002";

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

const validateEndpoint = (endpoint: string): void => {
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Choose a valid HTTPS push endpoint.",
    });
  }
  const hostname = parsed.hostname.toLowerCase();
  const allowedHosts = (
    process.env["WEB_PUSH_ALLOWED_HOSTS"] ??
    "fcm.googleapis.com,push.services.mozilla.com,web.push.apple.com"
  )
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  const trustedPushProvider = allowedHosts.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`)
  );
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    isIP(hostname) !== 0 ||
    !trustedPushProvider
  ) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Choose a valid HTTPS push endpoint.",
    });
  }
};

const requireActiveUser = async (userId: string): Promise<void> => {
  const user = await db.orm.public.User.where({ id: userId })
    .select("deactivatedAt", "mustChangePassword")
    .first();
  if (!user || user.deactivatedAt) {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Sign in to continue.",
    });
  }
  if (user.mustChangePassword) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Change your password before continuing.",
    });
  }
};

const register: PushNotifications["Service"]["register"] = (userId, raw) =>
  Effect.tryPromise({
    catch: mapError,
    try: async () => {
      let input: PushInput;
      try {
        input = Schema.decodeUnknownSync(PushInputSchema)(raw);
      } catch {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "The push subscription is invalid.",
        });
      }
      validateEndpoint(input.endpoint);
      await requireActiveUser(userId);
      const existing = await db.orm.public.PushSubscription.where({
        endpoint: input.endpoint,
      }).first();
      if (existing && existing.userId !== userId) {
        throw new AppError({
          code: "CONFLICT",
          message:
            "This push endpoint is already registered to another account.",
        });
      }
      const now = new Date();
      await db.orm.public.PushSubscription.upsert({
        conflictOn: { endpoint: input.endpoint },
        create: {
          createdAt: now,
          endpoint: input.endpoint,
          id: randomUUID(),
          keys: input.keys,
          updatedAt: now,
          userAgent: input.userAgent,
          userId,
        },
        update: {
          keys: input.keys,
          updatedAt: now,
          userAgent: input.userAgent,
        },
      });
    },
  });

const unregister: PushNotifications["Service"]["unregister"] = (
  userId,
  endpoint
) =>
  Effect.tryPromise({
    catch: mapError,
    try: async () => {
      await requireActiveUser(userId);
      await db.orm.public.PushSubscription.where({ endpoint, userId }).delete();
    },
  });

const makeDeliver =
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

const makePushNotifications = (
  transport: PushTransportApi
): PushNotifications["Service"] =>
  PushNotifications.of({
    deliver: makeDeliver(transport),
    register,
    unregister,
  });

export const PushNotificationsLive = Layer.effect(
  PushNotifications,
  Effect.map(Effect.service(PushTransport), makePushNotifications)
);
