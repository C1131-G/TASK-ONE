import { Duration, Effect } from "effect";

import { logger } from "../core/logger";

// A health probe that cannot answer quickly is as good as down; the container
// HEALTHCHECK itself gives up after five seconds.
const DEFAULT_PROBE_TIMEOUT_MS = 2000;

export type ReadinessProbe = (signal: AbortSignal) => Promise<void>;

export interface ReadinessProbes {
  readonly database: ReadinessProbe;
  // Absent when private file storage is not configured.
  readonly storage?: ReadinessProbe;
}

type CheckStatus = "ok" | "unavailable" | "skipped";

const runProbe = (
  name: string,
  probe: ReadinessProbe | undefined,
  timeoutMs: number
): Effect.Effect<CheckStatus> => {
  if (!probe) {
    return Effect.succeed("skipped");
  }
  return Effect.tryPromise({
    catch: (error) => error,
    try: (signal) => probe(signal),
  }).pipe(
    Effect.timeout(Duration.millis(timeoutMs)),
    Effect.matchEffect({
      // Details stay in the logs; the public body only names the check.
      onFailure: (error) =>
        Effect.sync((): CheckStatus => {
          logger.error("A readiness check failed.", { check: name, error });
          return "unavailable";
        }),
      onSuccess: () => Effect.succeed<CheckStatus>("ok"),
    })
  );
};

/** Probes every dependency concurrently and answers 200 only if all pass. */
export const readinessResponse = async (
  probes: ReadinessProbes,
  options: { readonly timeoutMs?: number } = {}
): Promise<Response> => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  const checks = await Effect.runPromise(
    Effect.all(
      {
        database: runProbe("database", probes.database, timeoutMs),
        storage: runProbe("storage", probes.storage, timeoutMs),
      },
      { concurrency: "unbounded" }
    )
  );
  const ready = Object.values(checks).every(
    (status) => status !== "unavailable"
  );
  return Response.json(
    { checks, status: ready ? "ok" : "unavailable" },
    {
      headers: { "cache-control": "no-store" },
      status: ready ? 200 : 503,
    }
  );
};
