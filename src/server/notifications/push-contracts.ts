import type { Effect } from "effect";
import { Context, Schema } from "effect";

import type { AppError } from "../core/action-result";
import type { PushMessage } from "./push-transport";

export const KeysSchema = Schema.Struct({
  auth: Schema.String.check(Schema.isMinLength(8), Schema.isMaxLength(256)),
  p256dh: Schema.String.check(Schema.isMinLength(16), Schema.isMaxLength(256)),
});
export const PushInputSchema = Schema.Struct({
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
