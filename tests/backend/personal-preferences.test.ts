import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import { runEffectResult } from "../../src/server/core/action-result";
import {
  PersonalPreferences,
  PersonalPreferencesLive,
} from "../../src/server/preferences/personal-preferences";

it("saves bounded personal display preferences and keeps them private", async () => {
  const userId = randomUUID();
  const otherId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false), ($5, $6, $7, $7, $8, false)',
    [
      userId,
      "Preferences User",
      `${userId}@prefs-test.example`,
      "employee",
      otherId,
      "Other User",
      `${otherId}@prefs-test.example`,
      "employee",
    ]
  );

  try {
    const program = Effect.gen(function* save() {
      const preferences = yield* PersonalPreferences;
      yield* preferences.save(userId, {
        calendarView: "week",
        density: "compact",
        timezone: "Asia/Kolkata",
      });
      const own = yield* preferences.get(userId);
      const other = yield* preferences.get(otherId);
      return { other, own };
    });
    const result = await Effect.runPromise(
      Effect.provide(program, PersonalPreferencesLive)
    );

    expect(result.own).toEqual({
      calendarView: "week",
      density: "compact",
      timezone: "Asia/Kolkata",
    });
    expect(result.other).toEqual({});
  } finally {
    await authPool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [
      [userId, otherId],
    ]);
  }
});

it("rejects malformed UUIDs and unsupported time zones as schema errors", async () => {
  const userId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [
      userId,
      "Invalid Preferences",
      `${userId}@prefs-invalid.example`,
      "employee",
    ]
  );
  try {
    const malformedUuid = Effect.gen(function* saveInvalidUuid() {
      const preferences = yield* PersonalPreferences;
      return yield* preferences.save(userId, {
        defaultViewId: "------------------------------------",
        timezone: "Asia/Kolkata",
      });
    });
    const malformedTimeZone = Effect.gen(function* saveInvalidTimeZone() {
      const preferences = yield* PersonalPreferences;
      return yield* preferences.save(userId, { timezone: "Mars/Olympus" });
    });
    const [uuidResult, timezoneResult] = await Promise.all([
      runEffectResult(Effect.provide(malformedUuid, PersonalPreferencesLive)),
      runEffectResult(
        Effect.provide(malformedTimeZone, PersonalPreferencesLive)
      ),
    ]);

    expect(uuidResult).toMatchObject({
      error: { code: "VALIDATION_FAILED" },
      ok: false,
    });
    expect(timezoneResult).toMatchObject({
      error: { code: "VALIDATION_FAILED" },
      ok: false,
    });
  } finally {
    await authPool.query('DELETE FROM "user" WHERE id = $1', [userId]);
  }
});

it("keeps saved column widths through display saves and rejects out-of-range widths", async () => {
  const userId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [userId, "Width Preferences", `${userId}@prefs-widths.example`, "employee"]
  );

  try {
    const saveWidths = Effect.gen(function* saveWidths() {
      const preferences = yield* PersonalPreferences;
      yield* preferences.saveColumnWidths(userId, { due: 140, task: 320 });
      yield* preferences.save(userId, { density: "compact" });
      return yield* preferences.get(userId);
    });
    const tooNarrow = Effect.gen(function* saveNarrowWidth() {
      const preferences = yield* PersonalPreferences;
      return yield* preferences.saveColumnWidths(userId, { due: 20 });
    });
    const tooMany = Effect.gen(function* saveManyWidths() {
      const preferences = yield* PersonalPreferences;
      const widths = Object.fromEntries(
        Array.from({ length: 33 }, (_, index) => [`col${index}`, 120])
      );
      return yield* preferences.saveColumnWidths(userId, widths);
    });

    const saved = await Effect.runPromise(
      Effect.provide(saveWidths, PersonalPreferencesLive)
    );
    const [narrowResult, manyResult] = await Promise.all([
      runEffectResult(Effect.provide(tooNarrow, PersonalPreferencesLive)),
      runEffectResult(Effect.provide(tooMany, PersonalPreferencesLive)),
    ]);

    expect(saved).toEqual({
      density: "compact",
      taskTableColumnWidths: { due: 140, task: 320 },
    });
    expect(narrowResult).toMatchObject({
      error: { code: "VALIDATION_FAILED" },
      ok: false,
    });
    expect(manyResult).toMatchObject({
      error: { code: "VALIDATION_FAILED" },
      ok: false,
    });
  } finally {
    await authPool.query('DELETE FROM "user" WHERE id = $1', [userId]);
  }
});
