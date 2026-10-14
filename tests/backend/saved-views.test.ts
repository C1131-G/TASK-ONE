import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Schema } from "effect";

import { authPool } from "../../src/server/auth/database";
import { runEffectResult } from "../../src/server/core/action-result";
import {
  SavedViewManagement,
  SavedViewManagementLive,
  SavedViewSummarySchema,
} from "../../src/server/preferences/saved-view-management";
import {
  defaultSavedViewFilters,
  defaultSavedViewSort,
} from "../../src/server/preferences/saved-view-settings";

it("rejects non-JSON values in saved-view output settings", () => {
  expect(() =>
    Schema.decodeUnknownSync(SavedViewSummarySchema)({
      createdAt: new Date().toISOString(),
      filters: { handler: () => false },
      groupBy: null,
      hiddenColumns: [],
      id: randomUUID(),
      isShared: false,
      name: "Invalid saved view",
      projectId: null,
      sort: defaultSavedViewSort,
      type: "board",
      updatedAt: new Date().toISOString(),
      userId: randomUUID(),
    })
  ).toThrow();
});

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
        filters: { priority: ["high"], query: "", status: ["todo"] },
        groupBy: "status",
        hiddenColumns: ["estimate"],
        isShared: true,
        name: "Team backlog",
        projectId: null,
        sort: { direction: "asc", field: "due" },
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
        filters: defaultSavedViewFilters,
        groupBy: null,
        hiddenColumns: [],
        isShared: false,
        name: "My list",
        projectId: null,
        sort: defaultSavedViewSort,
        type: "list",
      });
    });
    const personal = await Effect.runPromise(
      Effect.provide(createPrivate, SavedViewManagementLive)
    );
    const employeeAttempt = Effect.gen(function* employeeAttempt() {
      const views = yield* SavedViewManagement;
      return yield* views.createView(employeeId, {
        filters: defaultSavedViewFilters,
        groupBy: null,
        hiddenColumns: [],
        isShared: true,
        name: "Public attempt",
        projectId: null,
        sort: defaultSavedViewSort,
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

it("rejects saved-view settings outside the supported typed shape", async () => {
  const administratorId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'admin\', false)',
    [
      administratorId,
      "Typed Views Admin",
      `${administratorId}@views-typed.example`,
    ]
  );
  try {
    const invalid = await runEffectResult(
      Effect.provide(
        Effect.gen(function* createInvalid() {
          const views = yield* SavedViewManagement;
          return yield* views.createView(administratorId, {
            filters: { priority: ["high"], query: "", status: ["todo"] },
            groupBy: "assignee",
            hiddenColumns: [],
            isShared: false,
            name: "Unsupported grouping",
            projectId: null,
            sort: { direction: "asc", field: "dueDate" },
            type: "list",
          });
        }),
        SavedViewManagementLive
      )
    );
    expect(invalid).toMatchObject({
      error: { code: "VALIDATION_FAILED" },
      ok: false,
    });
  } finally {
    await authPool.query('DELETE FROM saved_view WHERE "userId" = $1', [
      administratorId,
    ]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [administratorId]);
  }
});

it("reads legacy empty settings rows as the typed defaults", async () => {
  const administratorId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'admin\', false)',
    [
      administratorId,
      "Legacy Views Admin",
      `${administratorId}@views-legacy.example`,
    ]
  );
  try {
    await authPool.query(
      `INSERT INTO saved_view (id, "userId", name, type, "isShared", filters, sort, "hiddenColumns", "createdAt", "updatedAt")
       VALUES ($1, $2, 'Legacy view', 'list', false, '{}'::jsonb, '{}'::jsonb, '[]'::jsonb, now(), now())`,
      [randomUUID(), administratorId]
    );
    const listed = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* listLegacy() {
          const views = yield* SavedViewManagement;
          return yield* views.listViews(administratorId);
        }),
        SavedViewManagementLive
      )
    );
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      filters: defaultSavedViewFilters,
      groupBy: null,
      hiddenColumns: [],
      sort: defaultSavedViewSort,
    });
  } finally {
    await authPool.query('DELETE FROM saved_view WHERE "userId" = $1', [
      administratorId,
    ]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [administratorId]);
  }
});
