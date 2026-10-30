import { Effect } from "effect";

import { respondWith } from "@/src/server/api/http-response";
import { readWorkload } from "@/src/server/api/lists/insight";
import { AuthSessionLive } from "@/src/server/auth/session";

export const GET = (request: Request): Promise<Response> =>
  respondWith(readWorkload(request).pipe(Effect.provide(AuthSessionLive)));
