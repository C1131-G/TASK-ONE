import type { Schema } from "effect";
import { Effect, Layer } from "effect";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import type { PortalUser } from "@/src/server/auth/session";
import type { ActionResult, AppError } from "@/src/server/core/action-result";
import type { Idempotency } from "@/src/server/core/idempotency";
import { IdempotencyLive } from "@/src/server/core/idempotency";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import type { Notifications } from "@/src/server/notifications/service";
import { NotificationsLive } from "@/src/server/notifications/service";
import { PortalBugsLive } from "@/src/server/portal/portal-bugs";
import type {
  PortalActor,
  PortalBugs,
} from "@/src/server/portal/portal-contracts";
import { StorageLive } from "@/src/server/storage/storage";
import { UploadsLive } from "@/src/server/storage/uploads";
import type { Uploads } from "@/src/server/storage/uploads-contracts";

export type PortalServices = PortalBugs | Idempotency | Notifications | Uploads;

export const toPortalActor = (user: PortalUser): PortalActor => ({
  clientCompanyId: user.clientCompanyId,
  id: user.id,
  name: user.name,
});

// Every portal query and action starts here: the signed-in client's session
// supplies the company, and nothing from the request can change it.
export const runPortalAction = <
  InputSchema extends Schema.Codec<unknown, unknown, never, never>,
  OutputSchema extends Schema.Codec<unknown, unknown, never, never>,
>(
  input: unknown,
  schema: InputSchema,
  execute: (
    user: PortalUser,
    validated: InputSchema["Type"]
  ) => Effect.Effect<OutputSchema["Type"], AppError, PortalServices>,
  outputSchema: OutputSchema
): Promise<ActionResult<OutputSchema["Type"]>> =>
  runServerAction(
    input,
    schema,
    (validated) =>
      Effect.gen(function* authorizePortalAction() {
        const requestHeaders = yield* requestHeadersOrFail;
        const sessions = yield* AuthSession;
        const user = yield* sessions.requirePortalAccess(requestHeaders);
        return yield* execute(user, validated).pipe(
          Effect.provide(PortalBugsLive),
          Effect.provide(NotificationsLive),
          Effect.provide(Layer.provide(UploadsLive, StorageLive)),
          Effect.provide(IdempotencyLive)
        );
      }).pipe(Effect.provide(AuthSessionLive)),
    undefined,
    outputSchema
  );
