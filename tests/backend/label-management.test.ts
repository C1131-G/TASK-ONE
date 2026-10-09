import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import { runEffectResult } from "../../src/server/core/action-result";
import {
  LabelManagement,
  LabelManagementLive,
} from "../../src/server/tasks/label-management";

it("lets admins manage labels and rejects employee changes", async () => {
  const adminId = randomUUID();
  const employeeId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false), ($5, $6, $7, $7, $8, false)',
    [
      adminId,
      "Label Admin",
      `${adminId}@labels-test.example`,
      "admin",
      employeeId,
      "Label Employee",
      `${employeeId}@labels-test.example`,
      "employee",
    ]
  );

  try {
    const program = Effect.gen(function* manage() {
      const labels = yield* LabelManagement;
      const created = yield* labels.create(adminId, {
        color: "#336699",
        name: "Design",
      });
      const updated = yield* labels.update(adminId, created.id, {
        color: "#225588",
        name: "Product design",
      });
      const listed = yield* labels.list(employeeId);
      yield* labels.remove(adminId, created.id);
      return { listed, updated };
    });
    const result = await Effect.runPromise(
      Effect.provide(program, LabelManagementLive)
    );
    const denied = await runEffectResult(
      Effect.provide(
        Effect.gen(function* employeeWrite() {
          const labels = yield* LabelManagement;
          return yield* labels.create(employeeId, {
            color: "red",
            name: "Forbidden",
          });
        }),
        LabelManagementLive
      )
    );

    expect(result.updated.name).toBe("Product design");
    expect(result.listed.map(({ id }) => id)).toContain(result.updated.id);
    expect(denied).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
  } finally {
    await authPool.query("DELETE FROM label WHERE name IN ($1, $2)", [
      "Design",
      "Product design",
    ]);
    await authPool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [
      [adminId, employeeId],
    ]);
  }
});
