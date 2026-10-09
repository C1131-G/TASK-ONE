import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer, Schema } from "effect";

import { authPool } from "../../src/server/auth/database";
import {
  Idempotency,
  IdempotencyLive,
} from "../../src/server/core/idempotency";
import {
  DiscoveryManagement,
  DiscoveryManagementLive,
} from "../../src/server/preferences/discovery-management";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

it("replays a favorite toggle without flipping the favorite back", async () => {
  const userId = randomUUID();
  const projectId = randomUUID();
  const suffix = projectId.replaceAll("-", "").slice(0, 6).toUpperCase();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [userId, "Favorite Toggle", `${userId}@favorite-idem.example`]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `F${suffix}`, "Favorite toggle"]
  );

  try {
    const outcome = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* toggleTwice() {
          const idempotency = yield* Idempotency;
          const discovery = yield* DiscoveryManagement;
          const toggle = (key: string) =>
            idempotency.run({
              actorId: userId,
              execute: () => discovery.toggleProjectFavorite(userId, projectId),
              input: { projectId },
              key,
              operation: "projectFavorite.toggle",
              resultSchema: Schema.Boolean,
            });
          const first = yield* toggle("favorite-toggle-0001");
          const retried = yield* toggle("favorite-toggle-0001");
          const next = yield* toggle("favorite-toggle-0002");
          return { first, next, retried };
        }),
        Layer.mergeAll(IdempotencyLive, DiscoveryManagementLive)
      )
    );

    expect(outcome.retried).toBe(outcome.first);
    expect(outcome.next).toBe(!outcome.first);
  } finally {
    await authPool.query('DELETE FROM idempotency_key WHERE "actorId" = $1', [
      userId,
    ]);
    await authPool.query('DELETE FROM favorite_project WHERE "userId" = $1', [
      userId,
    ]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [userId]);
  }
});
