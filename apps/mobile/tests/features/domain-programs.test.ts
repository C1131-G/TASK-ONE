import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { expect } from "vitest";

import { WORKSPACE_DOMAIN_FIXTURES } from "@/api/mocks/workspace-domains";
import { WORKSPACE_FIXTURES } from "@/api/mocks/workspace";
import { PORTAL_MORE_FIXTURES } from "@/api/mocks/portal-more";
import { makeMockMobileApiLayer } from "@/api/mock/mock-fetch";
import {
  activityProgram,
  archiveProgram,
  budgetsProgram,
  clientsProgram,
  favoritesProgram,
  filesProgram,
  membersProgram,
  myTimeProgram,
  searchProgram,
  teamsProgram,
  workloadProgram,
} from "@/features/workspace/domain-queries";
import {
  portalApprovalsProgram,
  portalNotificationsProgram,
} from "@/features/portal/portal-queries";
import { overviewProgram } from "@/features/workspace/overview-program";
import { MobileApi, TokenSource } from "@/services/mobile-api";

const ALL_FIXTURES = [
  ...WORKSPACE_FIXTURES,
  ...WORKSPACE_DOMAIN_FIXTURES,
  ...PORTAL_MORE_FIXTURES,
];
const MOCKED = new Set([
  "activity",
  "archive",
  "approvals",
  "budgets",
  "clients",
  "favorites",
  "files",
  "members",
  "my-time",
  "notifications",
  "projects",
  "search",
  "teams",
  "workload",
]);

const tokenLayer = Layer.succeed(
  TokenSource,
  TokenSource.of({ currentToken: Effect.succeed("t"), onUnauthenticated: Effect.void }),
);

/** Runs one program against a fresh mock API layer. */
const runWithMock = <A>(
  program: (api: MobileApi["Service"]) => Effect.Effect<A, unknown>,
  assert: (page: A) => void,
): Effect.Effect<void, unknown> =>
  Effect.flatMap(makeMockMobileApiLayer(ALL_FIXTURES, MOCKED), (apiLayer) => {
    const full = Layer.mergeAll(Layer.provide(apiLayer, tokenLayer), tokenLayer);
    return Effect.flatMap(Effect.service(MobileApi), program)
      .pipe(Effect.provide(full))
      .pipe(Effect.flatMap((page) => Effect.sync(() => assert(page))));
  });

const programs: readonly [
  string,
  (api: MobileApi["Service"]) => Effect.Effect<
    { rows: readonly { id: string; subtitle: string | null; title: string }[] },
    unknown
  >,
][] = [
  ["my time", myTimeProgram],
  ["workload", workloadProgram],
  ["budgets", budgetsProgram],
  ["files", filesProgram],
  ["members", membersProgram],
  ["teams", teamsProgram],
  ["clients", clientsProgram],
  ["activity", activityProgram],
  ["favorites", favoritesProgram],
  ["archive", archiveProgram],
  ["portal approvals", portalApprovalsProgram],
  ["portal notifications", portalNotificationsProgram],
];

for (const [name, program] of programs) {
  it.effect(`lists ${name} rows through the mock layer`, () =>
    runWithMock(program, (page) => {
      expect(page.rows.length, name).toBeGreaterThan(0);
      expect(page.rows[0]?.title, name).toBeTruthy();
      expect(typeof page.rows[0]?.subtitle, name).toBe("string");
    }),
  );
}

it.effect("searches the workspace by text", () =>
  runWithMock((api) => searchProgram(api, "landing"), (page) => {
    expect(page.rows[0]?.title).toBe("Ship the landing page");
    expect(page.rows[0]?.kind).toBe("task");
  }),
);

it.effect("aggregates the overview from projects", () =>
  runWithMock((api) => overviewProgram(api), (page) => {
    expect(page.rows[0]?.title).toContain("Website relaunch");
  }),
);
