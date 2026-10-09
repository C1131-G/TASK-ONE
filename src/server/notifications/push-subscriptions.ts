import { randomUUID } from "node:crypto";

import { Effect, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { PushInput, PushNotifications } from "./push-contracts";
import { PushInputSchema } from "./push-contracts";
import { mapError, requireActiveUser, validateEndpoint } from "./push-internal";

export const register: PushNotifications["Service"]["register"] = (
  userId,
  raw
) =>
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

export const unregister: PushNotifications["Service"]["unregister"] = (
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
