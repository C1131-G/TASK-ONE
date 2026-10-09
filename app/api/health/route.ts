import { Effect } from "effect";

import { db } from "@/src/prisma/db";
import { runEffectResult } from "@/src/server/core/action-result";

export const GET = async () => {
  const result = await runEffectResult(
    Effect.tryPromise({
      catch: () => new Error("Database health check failed."),
      try: () => db.orm.public.User.select("id").limit(1).all(),
    })
  );
  const healthy = result.ok;

  return Response.json(
    { status: healthy ? "ok" : "unavailable" },
    {
      headers: { "cache-control": "no-store" },
      status: healthy ? 200 : 503,
    }
  );
};
