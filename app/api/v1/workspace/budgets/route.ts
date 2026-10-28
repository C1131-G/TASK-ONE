import { Effect } from "effect";

import { respondWith } from "@/src/server/api/http-response";
import { listWorkspaceBudgets } from "@/src/server/api/lists/projects";
import { AuthSessionLive } from "@/src/server/auth/session";

export const GET = (request: Request): Promise<Response> =>
  respondWith(
    listWorkspaceBudgets(request).pipe(Effect.provide(AuthSessionLive))
  );
