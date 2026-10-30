import { Effect } from "effect";

import { respondWith } from "@/src/server/api/http-response";
import { listClientCompanyPage } from "@/src/server/api/lists/directory";
import { AuthSessionLive } from "@/src/server/auth/session";

export const GET = (request: Request): Promise<Response> =>
  respondWith(
    listClientCompanyPage(request).pipe(Effect.provide(AuthSessionLive))
  );
