import { afterAll, beforeAll, expect, it } from "bun:test";

import { Effect } from "effect";

import { AuthSession, AuthSessionLive } from "../../src/server/auth/session";
import { runEffectResult } from "../../src/server/core/action-result";
import { allActions } from "./action-permissions-catalog";
import { collectViolations } from "./action-permissions-shared";
import {
  authPool,
  callAs,
  ids,
  personaHeaders,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import type { ActionResultLike } from "./support/action-harness";

const userQueries = await import("../../features/user/user-queries");

beforeAll(setupHarness);
afterAll(teardownHarness);

// Account-level actions every signed-in person keeps, clients included: they
// change their own password and manage their own sessions and preferences.
const accountActions = new Set([
  "changeOwnPasswordAction",
  "listMySessions",
  "revokeSessionAction",
]);

const forbidden = (result: ActionResultLike): boolean =>
  !result.ok && result.error.code === "FORBIDDEN";

it("refuses every workspace action and query for a client account", async () => {
  const workspaceEntries = allActions.filter(
    ({ name }) => !accountActions.has(name)
  );
  const violations = await collectViolations(
    "client",
    workspaceEntries,
    forbidden
  );
  expect(violations).toEqual([]);
});

it("lists a client's own sessions", async () => {
  const sessions = await callAs("client", userQueries.listMySessions, {});
  expect(sessions.ok).toBe(true);
});

it("keeps account-level actions reachable for a client account", async () => {
  const accountEntries = allActions.filter(({ name }) =>
    accountActions.has(name)
  );
  expect(accountEntries).toHaveLength(accountActions.size);
  const violations = await collectViolations(
    "client",
    accountEntries,
    (result) => result.ok || result.error.code !== "FORBIDDEN"
  );
  expect(violations).toEqual([]);
});

const sessionCheck = (
  persona: "admin" | "client" | "owner",
  gate: "requirePortalAccess" | "requireWorkspaceAccess"
) =>
  runEffectResult(
    Effect.provide(
      Effect.gen(function* checkSession() {
        const sessions = yield* AuthSession;
        return yield* sessions[gate](personaHeaders(persona));
      }),
      AuthSessionLive
    )
  );

it("resolves a client session to its company and keeps it out of the workspace", async () => {
  const portal = await sessionCheck("client", "requirePortalAccess");
  expect(portal).toMatchObject({
    data: { clientCompanyId: ids.clientCompanyId, role: "client" },
    ok: true,
  });
  const workspace = await sessionCheck("client", "requireWorkspaceAccess");
  expect(workspace).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
});

it("keeps employees and admins out of the client portal", async () => {
  for (const persona of ["owner", "admin"] as const) {
    // Sequential: each check reads the same session store.
    // eslint-disable-next-line no-await-in-loop
    const portal = await sessionCheck(persona, "requirePortalAccess");
    expect(portal).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
  }
});

it("signs a client out of the portal once their company is deactivated", async () => {
  const creator = await authPool.query<{ id: string }>(
    'SELECT "createdById" AS id FROM client_company WHERE id = $1',
    [ids.clientCompanyId]
  );
  const [admin] = creator.rows;
  await authPool.query(
    'UPDATE client_company SET "deactivatedAt" = now(), "deactivatedById" = $2 WHERE id = $1',
    [ids.clientCompanyId, admin?.id]
  );
  try {
    const portal = await sessionCheck("client", "requirePortalAccess");
    expect(portal).toMatchObject({
      error: { code: "UNAUTHENTICATED" },
      ok: false,
    });
  } finally {
    await authPool.query(
      'UPDATE client_company SET "deactivatedAt" = NULL, "deactivatedById" = NULL WHERE id = $1',
      [ids.clientCompanyId]
    );
  }
});
