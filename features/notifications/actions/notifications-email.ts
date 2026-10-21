import "server-only";
import { Effect, Layer, Schema } from "effect";
import { refresh, revalidatePath } from "next/cache";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import {
  DoneResultSchema,
  Idempotency,
  IdempotencyLive,
} from "@/src/server/core/idempotency";
import { IdempotencyKeySchema } from "@/src/server/core/input-schemas";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import { EmailNotifications } from "@/src/server/email/email-contracts";
import { EmailNotificationsLive } from "@/src/server/email/email-notifications";
import { MailTransportLive } from "@/src/server/email/mail-transport";

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function setEmailDigestAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      digest: Schema.Boolean,
      idempotencyKey: IdempotencyKeySchema,
    }),
    (validated) =>
      Effect.gen(function* setEmailDigest() {
        const sessions = yield* AuthSession;
        const user = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const email = yield* EmailNotifications;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () =>
            email
              .setDigest(user.id, validated.digest)
              .pipe(Effect.map(() => ({ done: true as const }))),
          input: { digest: validated.digest },
          key: validated.idempotencyKey,
          operation: "notification.setEmailDigest",
          resultSchema: DoneResultSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(
          Layer.provide(EmailNotificationsLive, MailTransportLive)
        ),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    DoneResultSchema
  );
  if (result.ok) {
    revalidatePath("/settings");
    refresh();
  }
  return result;
}
