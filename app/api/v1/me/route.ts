import { Effect } from "effect";

import { respondWith } from "@/src/server/api/http-response";
import { getMe } from "@/src/server/api/me";
import { AuthSessionLive } from "@/src/server/auth/session";

// Reading the request headers keeps this answer per request.
export const GET = (request: Request): Promise<Response> =>
  respondWith(getMe(request.headers).pipe(Effect.provide(AuthSessionLive)));
