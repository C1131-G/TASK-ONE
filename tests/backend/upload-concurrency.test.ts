import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import { authPool } from "../../src/server/auth/database";
import { runEffectResult } from "../../src/server/core/action-result";
import { Storage } from "../../src/server/storage/storage";
import { UploadsLive } from "../../src/server/storage/uploads";
import { Uploads } from "../../src/server/storage/uploads-contracts";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

const storageLayer = Layer.succeed(
  Storage,
  Storage.of({
    copyObject: () => Effect.void,
    deleteObject: () => Effect.void,
    signDownload: () => Effect.succeed("https://private.example/download"),
    signPreview: () => Effect.succeed("https://private.example/preview"),
    signUpload: () => Effect.succeed("https://private.example/upload"),
    verifyObject: () => Effect.void,
  })
);
const uploadsLayer = Layer.provide(UploadsLive, storageLayer);

interface Fixture {
  readonly actorId: string;
  readonly projectId: string;
  readonly taskId: string;
}

const seedFixture = async (): Promise<Fixture> => {
  const actorId = randomUUID();
  const projectId = randomUUID();
  const taskId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [actorId, "Upload Concurrency", `${actorId}@upload-conc.example`]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [
      projectId,
      `UC${projectId.replaceAll("-", "").slice(0, 5).toUpperCase()}`,
      "Upload concurrency",
    ]
  );
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, "createdById") VALUES ($1, $2, 1, $3, $4)',
    [taskId, projectId, "Upload concurrency task", actorId]
  );
  return { actorId, projectId, taskId };
};

const removeFixture = async ({ actorId, projectId }: Fixture) => {
  await authPool.query('DELETE FROM undo_record WHERE "actorId" = $1', [
    actorId,
  ]);
  await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [actorId]);
  await authPool.query('DELETE FROM file_asset WHERE "projectId" = $1', [
    projectId,
  ]);
  await authPool.query('DELETE FROM upload_intent WHERE "ownerId" = $1', [
    actorId,
  ]);
  await authPool.query('DELETE FROM task WHERE "projectId" = $1', [projectId]);
  await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
  await authPool.query('DELETE FROM "user" WHERE id = $1', [actorId]);
};

it("lets exactly one of several concurrent removals of the same file win", async () => {
  const fixture = await seedFixture();
  const fileId = randomUUID();
  try {
    await authPool.query(
      'INSERT INTO file_asset (id, "projectId", "taskId", "uploadedById", "originalName", "storageKey", "contentType", "sizeBytes") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [
        fileId,
        fixture.projectId,
        fixture.taskId,
        fixture.actorId,
        "remove.txt",
        `tasks/${fileId}/remove.txt`,
        "text/plain",
        12,
      ]
    );
    const remove = () =>
      runEffectResult(
        Effect.provide(
          Effect.gen(function* removeFile() {
            const uploads = yield* Uploads;
            return yield* uploads.removeFile(fixture.actorId, fileId);
          }),
          uploadsLayer
        )
      );
    const outcomes = await Promise.all([remove(), remove(), remove()]);

    const succeeded = outcomes.filter((outcome) => outcome.ok);
    expect(succeeded).toHaveLength(1);
    for (const outcome of outcomes.filter((entry) => !entry.ok)) {
      expect(outcome).toMatchObject({
        error: { code: expect.stringMatching(/CONFLICT|NOT_FOUND/u) },
        ok: false,
      });
    }
    const receipts = await authPool.query(
      'SELECT id FROM undo_record WHERE "actorId" = $1',
      [fixture.actorId]
    );
    expect(receipts.rows).toHaveLength(1);
  } finally {
    await removeFixture(fixture);
  }
});

it("creates one file when the same upload is finalized concurrently", async () => {
  const fixture = await seedFixture();
  try {
    const intent = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* requestUpload() {
          const uploads = yield* Uploads;
          return yield* uploads.requestTaskUpload(fixture.actorId, {
            contentType: "application/pdf",
            fileName: "concurrent.pdf",
            sizeBytes: 2048,
            taskId: fixture.taskId,
          });
        }),
        uploadsLayer
      )
    );
    const finalize = () =>
      runEffectResult(
        Effect.provide(
          Effect.gen(function* finalizeUpload() {
            const uploads = yield* Uploads;
            return yield* uploads.finalizeUpload(
              fixture.actorId,
              intent.uploadIntentId
            );
          }),
          uploadsLayer
        )
      );
    const outcomes = await Promise.all([finalize(), finalize(), finalize()]);

    expect(outcomes.some((outcome) => outcome.ok)).toBe(true);
    for (const outcome of outcomes.filter((entry) => !entry.ok)) {
      expect(outcome).toMatchObject({
        error: { code: "CONFLICT" },
        ok: false,
      });
    }
    const files = await authPool.query(
      'SELECT id FROM file_asset WHERE "projectId" = $1',
      [fixture.projectId]
    );
    expect(files.rows).toHaveLength(1);
  } finally {
    await removeFixture(fixture);
  }
});
