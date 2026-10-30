import { randomUUID } from "node:crypto";

import type { RouteDefinition } from "../../../src/mobile-api/route-definition";

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

export interface Answer {
  readonly message: string;
  readonly path: string;
  readonly status: number;
}

// Calls a route's handler the way Next does, with made-up ids for any path
// parameters and an empty body, so the answer shows who is let through the
// door rather than what the route does for them.
export const callRoute = async (
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
    `../../../apps/web/app/api/v1/${folder}/route`
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
