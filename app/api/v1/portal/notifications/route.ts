import { Effect } from "effect";

import { respondWith } from "@/src/server/api/http-response";
import { listPortalInbox } from "@/src/server/api/notifications/portal";
import { AuthSessionLive } from "@/src/server/auth/session";

// Reading the request headers keeps this answer per request.
export const GET = (request: Request): Promise<Response> =>
  respondWith(
    listPortalInbox(request.headers).pipe(Effect.provide(AuthSessionLive))
  );
