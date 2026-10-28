import { afterAll, beforeAll, expect, it } from "bun:test";

import type { RouteDefinition } from "../../src/mobile-api/route-definition";
import { mobileRoutes } from "../../src/mobile-api/routes";
import {
  personaBearerToken,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import type { Persona } from "./support/action-harness";
import { callRoute } from "./support/mobile-route-caller";

beforeAll(setupHarness);
afterAll(teardownHarness);

// Every route must go through the one gate (`readRouteInput`): that is where a
// request is counted against the rate limit and tagged with the route and the
// person for the request log. A route that skips it is neither limited nor
// traceable, and nothing else would notice. So each route is called as someone
// who is let through the door, and its log line must name the route and them.
const callerFor = (route: RouteDefinition): Persona =>
  route.path.startsWith("/api/v1/portal/") ? "client" : "owner";

interface LogEntry {
  readonly method?: string;
  readonly operationId?: string;
  readonly requestId: string;
  readonly status: number;
  readonly userId?: string;
}

const captureLogs = async (run: () => Promise<void>): Promise<LogEntry[]> => {
  const lines: string[] = [];
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    lines.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  try {
    await run();
  } finally {
    process.stdout.write = original;
  }
  return lines
    .flatMap((chunk) => chunk.split("\n"))
    .filter((line) => line.startsWith("{"))
    .map((line) => JSON.parse(line) as Record<string, unknown>)
    .filter((entry) => entry["message"] === "Mobile API request")
    .map((entry) => entry as unknown as LogEntry);
};

it("counts and logs every route, naming the route and the person", async () => {
  const entries = await captureLogs(async () => {
    for (const route of mobileRoutes) {
      // Routes are called one after another so each leaves its own log line.
      // eslint-disable-next-line no-await-in-loop
      await callRoute(route, personaBearerToken(callerFor(route)));
    }
  });

  const missing = mobileRoutes
    .filter((route) => {
      const person = personaId(callerFor(route));
      return !entries.some(
        (entry) =>
          entry.operationId === route.operationId &&
          entry.method === route.method &&
          entry.userId === person
      );
    })
    .map((route) => `${route.method.toUpperCase()} ${route.path}`);

  expect(missing).toEqual([]);
  expect(entries).toHaveLength(mobileRoutes.length);
});
