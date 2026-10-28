import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import type { RouteDefinition } from "../../src/mobile-api/route-definition";
import { mobileRoutes } from "../../src/mobile-api/routes";
import {
  authPool,
  personaBearerToken,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import type { Persona } from "./support/action-harness";

// The same gate answers every route, so the matrix asks each route as each kind
// of caller and checks only who is let through the door. What a route does for
// someone who passed the door is covered by that route's own tests.
const STAFF_ONLY = "This area is only available to workspace members.";
const CLIENT_ONLY = "The client portal is only available to client accounts.";
const PASSWORD_FIRST = "Change your password before continuing.";
const GATE_MESSAGES = new Set([STAFF_ONLY, CLIENT_ONLY, PASSWORD_FIRST]);

type Audience = "any" | "client" | "staff";

const audienceOf = (route: RouteDefinition): Audience | "unknown" => {
  if (route.path.startsWith("/api/v1/workspace/")) {
    return "staff";
  }
  if (route.path.startsWith("/api/v1/portal/")) {
    return "client";
  }
  return route.path === "/api/v1/me" || route.path.startsWith("/api/v1/me/")
    ? "any"
    : "unknown";
};

const isParameter = (segment: string): boolean =>
  segment.startsWith("{") && segment.endsWith("}");

type RouteModule = Readonly<
  Record<
    string,
    (
      request: Request,
      context: { params: Promise<Record<string, string>> }
    ) => Promise<Response>
  >
>;

interface Answer {
  readonly message: string;
  readonly path: string;
  readonly status: number;
}

const callRoute = async (
  route: RouteDefinition,
  token: string
): Promise<Answer> => {
  const segments = route.path.replace("/api/v1/", "").split("/");
  const folder = segments
    .map((segment) =>
      isParameter(segment) ? `[${segment.slice(1, -1)}]` : segment
    )
    .join("/");
  const params: Record<string, string> = {};
  const url = segments
    .map((segment) => {
      if (!isParameter(segment)) {
        return segment;
      }
      const name = segment.slice(1, -1);
      params[name] = randomUUID();
      return params[name];
    })
    .join("/");
  const routeModule = (await import(
    `../../app/api/v1/${folder}/route`
  )) as RouteModule;
  const handler = routeModule[route.method.toUpperCase()];
  if (!handler) {
    throw new Error(`${route.method} is not exported for ${route.path}`);
  }
  const headers = new Headers();
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }
  const isRead = route.method === "get";
  if (!isRead) {
    headers.set("idempotency-key", `matrix-${randomUUID()}`);
    headers.set("content-type", "application/json");
  }
  const response = await handler(
    new Request(`http://localhost:3000/api/v1/${url}`, {
      ...(isRead ? {} : { body: "{}" }),
      headers,
      method: route.method.toUpperCase(),
    }),
    { params: Promise.resolve(params) }
  );
  const body = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return {
    message: body?.error?.message ?? "",
    path: `${route.method.toUpperCase()} ${route.path}`,
    status: response.status,
  };
};

const askAll = (token: string): Promise<Answer[]> =>
  Promise.all(mobileRoutes.map((route) => callRoute(route, token)));

const askAs = (persona: Persona): Promise<Answer[]> =>
  askAll(personaBearerToken(persona));

const askRoutes = async (
  persona: Persona,
  paths: ReadonlySet<string>
): Promise<Answer[]> => {
  const answers = await askAs(persona);
  return answers.filter(({ path }) => paths.has(path));
};

const routesOf = (audience: Audience): Set<string> =>
  new Set(
    mobileRoutes
      .filter((route) => audienceOf(route) === audience)
      .map((route) => `${route.method.toUpperCase()} ${route.path}`)
  );

const isGate = ({ message, status }: Answer): boolean =>
  status === 401 || (status === 403 && GATE_MESSAGES.has(message));

const offenders = (
  answers: readonly Answer[],
  keep: (answer: Answer) => boolean
): string[] =>
  answers
    .filter((answer) => !keep(answer))
    .map(({ path, status }) => `${path} -> ${status}`);

beforeAll(setupHarness);
afterAll(teardownHarness);

it("knows the audience of every route", () => {
  const unknown = mobileRoutes
    .filter((route) => audienceOf(route) === "unknown")
    .map((route) => route.path);

  expect(unknown).toEqual([]);
  expect(mobileRoutes.length).toBeGreaterThan(0);
});

it("answers 401 on every route without a token", async () => {
  expect(offenders(await askAll(""), ({ status }) => status === 401)).toEqual(
    []
  );
});

it("answers 401 on every route for a token that was never issued", async () => {
  expect(
    offenders(await askAll("not-a-real-token"), ({ status }) => status === 401)
  ).toEqual([]);
});

it("answers 401 on every route for a deactivated account", async () => {
  expect(
    offenders(await askAs("deactivated"), ({ status }) => status === 401)
  ).toEqual([]);
});

it("lets an account that must change its password reach only /me", async () => {
  const answers = await askAs("forced");
  const meRoutes = routesOf("any");

  expect(meRoutes.size).toBeGreaterThan(1);
  expect(
    offenders(answers, ({ path, status }) => {
      if (path === "GET /api/v1/me") {
        return status === 200;
      }
      // The empty body is refused by the route itself, which is past the door.
      return meRoutes.has(path) ? status === 422 : status === 403;
    })
  ).toEqual([]);
});

it("keeps a client out of every workspace route", async () => {
  const staffRoutes = routesOf("staff");
  const answers = await askRoutes("client", staffRoutes);

  expect(answers.length).toBe(staffRoutes.size);
  expect(
    offenders(
      answers,
      ({ message, status }) => status === 403 && message === STAFF_ONLY
    )
  ).toEqual([]);
});

it("keeps admins and employees out of every portal route", async () => {
  const portalRoutes = routesOf("client");
  for (const persona of ["admin", "owner", "outsider"] as const) {
    // eslint-disable-next-line no-await-in-loop
    const answers = await askRoutes(persona, portalRoutes);

    expect(answers.length).toBe(portalRoutes.size);
    expect(
      offenders(
        answers,
        ({ message, status }) => status === 403 && message === CLIENT_ONLY
      )
    ).toEqual([]);
  }
});

it("lets admins and employees through the door of every workspace route", async () => {
  const staffRoutes = routesOf("staff");
  for (const persona of ["admin", "owner", "outsider"] as const) {
    // eslint-disable-next-line no-await-in-loop
    const answers = await askRoutes(persona, staffRoutes);

    expect(offenders(answers, (answer) => !isGate(answer))).toEqual([]);
  }
});

it("lets clients of either company through the door of every portal route", async () => {
  const portalRoutes = routesOf("client");
  for (const persona of ["client", "coworker", "otherClient"] as const) {
    // eslint-disable-next-line no-await-in-loop
    const answers = await askRoutes(persona, portalRoutes);

    expect(offenders(answers, (answer) => !isGate(answer))).toEqual([]);
  }
});

it("answers /me for every signed-in kind of account", async () => {
  for (const persona of ["admin", "owner", "client", "otherClient"] as const) {
    // eslint-disable-next-line no-await-in-loop
    const answers = await askRoutes(persona, routesOf("any"));

    expect(offenders(answers, (answer) => !isGate(answer))).toEqual([]);
    expect(answers.find(({ path }) => path === "GET /api/v1/me")?.status).toBe(
      200
    );
  }
});

it("answers 401 on every route once the session was revoked", async () => {
  const token = personaBearerToken("coworker");
  expect(token).not.toBe("");
  await authPool.query('DELETE FROM session WHERE "userId" = $1', [
    personaId("coworker"),
  ]);

  expect(
    offenders(await askAll(token), ({ status }) => status === 401)
  ).toEqual([]);
});
