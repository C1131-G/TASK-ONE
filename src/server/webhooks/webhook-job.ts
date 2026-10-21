import { Effect, Schema } from "effect";

import { AppError } from "../core/action-result";

const WebhookJobPayloadSchema = Schema.Struct({
  deliveryId: Schema.String.check(Schema.isUUID()),
});

export const decodeWebhookJob = (payload: unknown) =>
  Effect.try({
    catch: () =>
      new AppError({
        code: "VALIDATION_FAILED",
        message: "The webhook delivery job payload is invalid.",
      }),
    try: () => Schema.decodeUnknownSync(WebhookJobPayloadSchema)(payload),
  });
