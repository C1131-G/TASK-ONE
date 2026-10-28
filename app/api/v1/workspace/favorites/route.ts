import { Effect } from "effect";

import { respondWith } from "@/src/server/api/http-response";
import { listFavoritePage } from "@/src/server/api/lists/find";
import { AuthSessionLive } from "@/src/server/auth/session";

export const GET = (request: Request): Promise<Response> =>
  respondWith(listFavoritePage(request).pipe(Effect.provide(AuthSessionLive)));
