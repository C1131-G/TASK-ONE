import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import { runEffectResult } from "../../src/server/core/action-result";
import {
  SavedViewManagement,
  SavedViewManagementLive,
} from "../../src/server/preferences/saved-view-management";

it("shares admin views with employees while keeping personal views private", async () => {
  const administratorId = randomUUID();
  const employeeId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false), ($5, $6, $7, $7, $8, false)',
    [
      administratorId,
      "Views Admin",
      `${administratorId}@views-test.example`,
      "admin",
      employeeId,
      "Views Employee",
      `${employeeId}@views-test.example`,
      "employee",
    ]
  );

  try {
    const createShared = Effect.gen(function* createShared() {
      const views = yield* SavedViewManagement;
      return yield* views.createView(administratorId, {
        filters: [{ field: "status", value: "todo" }],
        groupBy: "assignee",
        hiddenColumns: ["estimate"],
        isShared: true,
        name: "Team backlog",
        projectId: null,
        sort: { by: "dueDate", direction: "asc" },
        type: "board",
      });
    });
    const shared = await Effect.runPromise(
      Effect.provide(createShared, SavedViewManagementLive)
    );
    const employeeViews = Effect.gen(function* employeeViews() {
      const views = yield* SavedViewManagement;
      return yield* views.listViews(employeeId);
    });
    const visible = await Effect.runPromise(
      Effect.provide(employeeViews, SavedViewManagementLive)
    );
    const createPrivate = Effect.gen(function* createPrivate() {
      const views = yield* SavedViewManagement;
      return yield* views.createView(employeeId, {
        filters: [],
        groupBy: null,
        hiddenColumns: [],
        isShared: false,
        name: "My list",
        projectId: null,
        sort: {},
        type: "list",
      });
    });
    const personal = await Effect.runPromise(
      Effect.provide(createPrivate, SavedViewManagementLive)
    );
    const employeeAttempt = Effect.gen(function* employeeAttempt() {
      const views = yield* SavedViewManagement;
      return yield* views.createView(employeeId, {
        filters: [],
        groupBy: null,
        hiddenColumns: [],
        isShared: true,
        name: "Public attempt",
        projectId: null,
        sort: {},
        type: "board",
      });
    });
    const forbidden = await runEffectResult(
      Effect.provide(employeeAttempt, SavedViewManagementLive)
    );

    expect(visible.map(({ id }) => id)).toEqual([shared.id]);
    expect(personal.userId).toBe(employeeId);
    expect(forbidden).toMatchObject({
      error: { code: "FORBIDDEN" },
      ok: false,
    });
  } finally {
    await authPool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [
      [administratorId, employeeId],
    ]);
  }
});
