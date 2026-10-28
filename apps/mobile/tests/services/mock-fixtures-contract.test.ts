import { it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { expect } from "vitest";

import { NOTIFICATION_FIXTURES } from "@/api/mocks/notifications";
import { PORTAL_FIXTURES } from "@/api/mocks/portal";
import { PORTAL_MORE_FIXTURES } from "@/api/mocks/portal-more";
import { TASK_FIXTURES } from "@/api/mocks/tasks";
import { WORKSPACE_FIXTURES } from "@/api/mocks/workspace";
import { WORKSPACE_DOMAIN_FIXTURES } from "@/api/mocks/workspace-domains";
import { WORKSPACE_MORE_FIXTURES } from "@/api/mocks/workspace-more";
import { clientRoutes } from "@/api/routes-for-client";

const ALL_FIXTURES = [
  ...NOTIFICATION_FIXTURES,
  ...PORTAL_FIXTURES,
  ...PORTAL_MORE_FIXTURES,
  ...TASK_FIXTURES,
  ...WORKSPACE_FIXTURES,
  ...WORKSPACE_DOMAIN_FIXTURES,
  ...WORKSPACE_MORE_FIXTURES,
];

/** Every way one fixture differs from its route's live data schema. */
const problemsOf = (operationId: string, data: unknown) =>
  Effect.gen(function* problems() {
    const route = clientRoutes.find((candidate) => candidate.operationId === operationId);
    if (route === undefined) {
      return [`${operationId}: no such route`];
    }
    const decode = Schema.decodeUnknownEffect(
      route.data as unknown as Schema.Codec<unknown, unknown, never, never>,
    );
    const failure = yield* Effect.flip(decode(data ?? {}, { errors: "all" })).pipe(
      Effect.map((error) => String(error)),
      Effect.catch(() => Effect.succeed("")),
    );
    return failure === "" ? [] : [`${operationId}: ${failure}`];
  });

it.effect("every mock fixture matches its route's live data schema", () =>
  Effect.gen(function* check() {
    const problems = yield* Effect.forEach(ALL_FIXTURES, (fixture) =>
      problemsOf(fixture.operationId, fixture.data),
    );

    expect(problems.flat()).toEqual([]);
  }),
);
