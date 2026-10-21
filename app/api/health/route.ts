import { connection } from "next/server";

import { liveReadinessProbes } from "@/src/server/health/live-probes";
import { readinessResponse } from "@/src/server/health/readiness";

// Readiness: the instance can serve traffic only while its database (and
// private storage, when configured) answer. The Docker HEALTHCHECK uses this
// path; `/api/health/ready` is the same check under an explicit name.
export const GET = async (): Promise<Response> => {
  // Never prerender a health answer at build time.
  await connection();
  return readinessResponse(liveReadinessProbes);
};
