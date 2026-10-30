import { Effect } from "effect";

import { respondWith } from "@/src/server/api/http-response";
import { listArchivePage } from "@/src/server/api/lists/find";
import { AuthSessionLive } from "@/src/server/auth/session";

export const GET = (request: Request): Promise<Response> =>
  respondWith(listArchivePage(request).pipe(Effect.provide(AuthSessionLive)));
