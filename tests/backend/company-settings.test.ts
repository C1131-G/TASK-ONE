import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { db } from "../../src/prisma/db";
import { authPool } from "../../src/server/auth/database";
import {
  CompanySettingsManagement,
  CompanySettingsManagementLive,
} from "../../src/server/company/company-settings";

it("lets admins configure company identity and timezone while employees can only read", async () => {
  const adminId = randomUUID();
  const employeeId = randomUUID();
  const users = [adminId, employeeId];
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'admin\', false), ($4, $5, $6, $6, \'employee\', false)',
    [
      adminId,
      "Settings Admin",
      `${adminId}@company-settings-test.example`,
      employeeId,
      "Settings Employee",
      `${employeeId}@company-settings-test.example`,
    ]
  );

  try {
    const program = Effect.gen(function* manageSettings() {
      const settings = yield* CompanySettingsManagement;
      const updated = yield* settings.update(adminId, {
        brandColor: "#123abc",
        brandEnabled: true,
        name: "Gr8r Studio India",
        slug: "gr8r-studio-india",
        timeZone: "Asia/Kolkata",
      });
      const employeeRead = yield* settings.get(employeeId);
      const denied = yield* Effect.result(
        settings.update(employeeId, {
          ...updated,
          name: "Changed by employee",
        })
      );
      return { denied, employeeRead, updated };
    });
    const result = await Effect.runPromise(
      Effect.provide(program, CompanySettingsManagementLive)
    );

    expect(result.updated).toMatchObject({
      brandColor: "#123abc",
      name: "Gr8r Studio India",
      slug: "gr8r-studio-india",
      timeZone: "Asia/Kolkata",
    });
    expect(result.employeeRead).toEqual(result.updated);
    expect(result.denied._tag).toBe("Failure");
  } finally {
    await db.orm.public.CompanySettings.where({ id: "company" }).update({
      brandColor: "#1D1C1A",
      brandEnabled: true,
      name: "Gr8r Studio",
      slug: "gr8rstudio",
      timeZone: "Asia/Kolkata",
    });
    await authPool.query(
      'DELETE FROM activity WHERE "actorId" = ANY($1::text[])',
      [users]
    );
    await authPool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [
      users,
    ]);
  }
});
