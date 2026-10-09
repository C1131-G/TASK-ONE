import { expect, it } from "bun:test";
import { createHash, randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import { authPool } from "../../src/server/auth/database";
import { AppError } from "../../src/server/core/action-result";
import {
  Idempotency,
  IdempotencyLive,
} from "../../src/server/core/idempotency";
import {
  ProjectManagement,
  ProjectManagementLive,
  ProjectSummarySchema,
} from "../../src/server/projects/project-management";

const seedAdministrator = async (actorId: string): Promise<void> => {
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'admin\', false)',
    [actorId, "Idempotency Admin", `${actorId}@idempotency-coverage.example`]
  );
};

const cleanup = async (actorId: string, projectKeyPrefix: string) => {
  await authPool.query('DELETE FROM "idempotency_key" WHERE "actorId" = $1', [
    actorId,
  ]);
  await authPool.query("DELETE FROM project WHERE key LIKE $1", [
    `${projectKeyPrefix}%`,
  ]);
  await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [actorId]);
  await authPool.query('DELETE FROM "user" WHERE id = $1', [actorId]);
};

const runWithLayers = <Value, Failure>(
  program: Effect.Effect<Value, Failure, Idempotency | ProjectManagement>
) =>
  Effect.runPromise(
    Effect.provide(
      program,
      Layer.mergeAll(IdempotencyLive, ProjectManagementLive)
    )
  );

const projectInput = (key: string, name: string) => ({
  description: null,
  key,
  name,
  status: "planning" as const,
});

it("replays a project create once and rejects a changed payload on the same key", async () => {
  const actorId = randomUUID();
  const suffix = actorId.replaceAll("-", "").slice(0, 6);
  const prefix = `K${suffix}`.toUpperCase();
  await seedAdministrator(actorId);
  const idempotencyKey = `project-create-${suffix}`;
  const input = projectInput(`${prefix}A`, "Replayed project");

  try {
    const result = await runWithLayers(
      Effect.gen(function* createTwice() {
        const idempotency = yield* Idempotency;
        const projects = yield* ProjectManagement;
        const run = (payload: typeof input) =>
          idempotency.run({
            actorId,
            execute: () => projects.createProject(actorId, payload),
            input: payload,
            key: idempotencyKey,
            operation: "project.create",
            resultSchema: ProjectSummarySchema,
          });
        const first = yield* run(input);
        const replay = yield* run(input);
        const changed = yield* Effect.result(
          run({ ...input, name: "Different name" })
        );
        return { changed, first, replay };
      })
    );

    expect(result.replay.id).toBe(result.first.id);
    expect(result.changed._tag).toBe("Failure");
    const rows = await authPool.query("SELECT id FROM project WHERE key = $1", [
      `${prefix}A`,
    ]);
    expect(rows.rows).toHaveLength(1);
  } finally {
    await cleanup(actorId, prefix);
  }
});

it("runs concurrent same-key project creates exactly once", async () => {
  const actorId = randomUUID();
  const suffix = actorId.replaceAll("-", "").slice(0, 6);
  const prefix = `C${suffix}`.toUpperCase();
  await seedAdministrator(actorId);
  const idempotencyKey = `project-race-${suffix}`;
  const input = projectInput(`${prefix}B`, "Raced project");

  try {
    const outcomes = await runWithLayers(
      Effect.gen(function* raceCreates() {
        const idempotency = yield* Idempotency;
        const projects = yield* ProjectManagement;
        const attempt = () =>
          Effect.result(
            idempotency.run({
              actorId,
              execute: () => projects.createProject(actorId, input),
              input,
              key: idempotencyKey,
              operation: "project.create",
              resultSchema: ProjectSummarySchema,
            })
          );
        return yield* Effect.all([attempt(), attempt(), attempt()], {
          concurrency: "unbounded",
        });
      })
    );

    const successes = outcomes.filter((outcome) => outcome._tag === "Success");
    const failures = outcomes.filter((outcome) => outcome._tag === "Failure");
    expect(successes.length).toBeGreaterThanOrEqual(1);
    for (const failure of failures) {
      expect(failure.failure).toBeInstanceOf(AppError);
      expect(failure.failure.code).toBe("CONFLICT");
    }
    const rows = await authPool.query("SELECT id FROM project WHERE key = $1", [
      `${prefix}B`,
    ]);
    expect(rows.rows).toHaveLength(1);
  } finally {
    await cleanup(actorId, prefix);
  }
});

it("frees a key after a failed execution so the retry can succeed", async () => {
  const actorId = randomUUID();
  const suffix = actorId.replaceAll("-", "").slice(0, 6);
  const prefix = `F${suffix}`.toUpperCase();
  await seedAdministrator(actorId);
  const idempotencyKey = `project-retry-${suffix}`;
  const input = projectInput(`${prefix}C`, "Retried project");

  try {
    const result = await runWithLayers(
      Effect.gen(function* retryAfterFailure() {
        const idempotency = yield* Idempotency;
        const projects = yield* ProjectManagement;
        let attempts = 0;
        const execute = () =>
          Effect.suspend(() => {
            attempts += 1;
            if (attempts === 1) {
              return Effect.fail(
                new AppError({
                  code: "UNAVAILABLE",
                  message: "Simulated failure.",
                })
              );
            }
            return projects.createProject(actorId, input);
          });
        const first = yield* Effect.result(
          idempotency.run({
            actorId,
            execute,
            input,
            key: idempotencyKey,
            operation: "project.create",
            resultSchema: ProjectSummarySchema,
          })
        );
        const second = yield* idempotency.run({
          actorId,
          execute,
          input,
          key: idempotencyKey,
          operation: "project.create",
          resultSchema: ProjectSummarySchema,
        });
        return { first, second };
      })
    );

    expect(result.first._tag).toBe("Failure");
    expect(result.second.key).toBe(`${prefix}C`);
  } finally {
    await cleanup(actorId, prefix);
  }
});

it("rejects a stored result that no longer decodes instead of replaying it", async () => {
  const actorId = randomUUID();
  const suffix = actorId.replaceAll("-", "").slice(0, 6);
  await seedAdministrator(actorId);
  const idempotencyKey = `project-corrupt-${suffix}`;
  const input = { probe: "corrupt-result" };
  const requestHash = createHash("sha256")
    .update(JSON.stringify({ input, operation: "project.create" }))
    .digest("hex");
  await authPool.query(
    'INSERT INTO "idempotency_key" (id, "actorId", key, "requestHash", response, "expiresAt", "createdAt") VALUES ($1, $2, $3, $4, $5::jsonb, now() + interval \'1 day\', now())',
    [
      randomUUID(),
      actorId,
      idempotencyKey,
      requestHash,
      JSON.stringify({ wrong: true }),
    ]
  );

  try {
    const outcome = await runWithLayers(
      Effect.gen(function* replayCorrupt() {
        const idempotency = yield* Idempotency;
        return yield* Effect.result(
          idempotency.run({
            actorId,
            execute: () => Effect.die("must not execute"),
            input,
            key: idempotencyKey,
            operation: "project.create",
            resultSchema: ProjectSummarySchema,
          })
        );
      })
    );

    expect(outcome._tag).toBe("Failure");
    if (outcome._tag === "Failure") {
      expect(outcome.failure.code).toBe("CONFLICT");
    }
  } finally {
    await cleanup(actorId, `Z${suffix}`);
  }
});
