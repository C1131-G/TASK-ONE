import { Effect } from "effect";

import type { RouteInput } from "../../../mobile-api/route-definition";
import { getPortalNotificationTargetRoute } from "../../../mobile-api/routes-notifications";
import type {
  markAllPortalNotificationsReadRoute,
  markPortalNotificationReadRoute,
} from "../../../mobile-api/routes-notifications";
import { AuthSession } from "../../auth/session";
import type { PortalUser } from "../../auth/session-types";
import type { PortalActor } from "../../portal/portal-contracts";
import { listPortalNotificationInbox } from "../../portal/portal-notification-inbox";
import { asPortalCaller } from "../bugs/caller";
import type { PathParams } from "../bugs/caller";
import { markAllNotificationsRead, markNotificationRead } from "./read-state";
import { openPortalTarget } from "./target";

// The company always comes from the signed-in client's session, never from
// the request. Kept local to the notifications branch.
const toPortalActor = (user: PortalUser): PortalActor => ({
  clientCompanyId: user.clientCompanyId,
  id: user.id,
  name: user.name,
});

// The app shows a title and ignores the body. The row keeps its text, and the
// mobile adapter repeats it as `title`; the web portal shape is untouched.
export const listPortalInbox = (headers: Headers) =>
  Effect.gen(function* listPortalInboxProgram() {
    const sessions = yield* AuthSession;
    const user = yield* sessions.requirePortalAccess(headers);
    const inbox = yield* listPortalNotificationInbox(toPortalActor(user));
    return {
      items: inbox.items.map((item) => ({ ...item, title: item.text })),
      unreadCount: inbox.unreadCount,
    };
  });

export const markPortalNotificationRead = (
  headers: Headers,
  input: RouteInput<typeof markPortalNotificationReadRoute>
) =>
  Effect.gen(function* markPortalReadProgram() {
    const sessions = yield* AuthSession;
    const user = yield* sessions.requirePortalAccess(headers);
    return yield* markNotificationRead(
      user.id,
      input.params.id,
      input.idempotencyKey
    );
  });

export const markAllPortalNotificationsRead = (
  headers: Headers,
  input: RouteInput<typeof markAllPortalNotificationsReadRoute>
) =>
  Effect.gen(function* markAllPortalReadProgram() {
    const sessions = yield* AuthSession;
    const user = yield* sessions.requirePortalAccess(headers);
    return yield* markAllNotificationsRead(user.id, input.idempotencyKey);
  });

// Where a notification leads, checked against the client's company now.
export const openPortalNotificationTarget = (
  request: Request,
  params: PathParams
) =>
  asPortalCaller(
    getPortalNotificationTargetRoute,
    request,
    params,
    ({ actor, input }) => openPortalTarget(actor, input.params.id)
  );
