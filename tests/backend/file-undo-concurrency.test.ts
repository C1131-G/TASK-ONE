import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import { authPool } from "../../src/server/auth/database";
import { runEffectResult } from "../../src/server/core/action-result";
import { Storage } from "../../src/server/storage/storage";
import { Uploads, UploadsLive } from "../../src/server/storage/uploads";

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

it("lets exactly one of several competing file-removal undos succeed", async () => {
  const actorId = randomUUID();
  const projectId = randomUUID();
  const taskId = randomUUID();
  const fileId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [actorId, "File Undo Owner", `${actorId}@file-undo-conc.example`]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [
      projectId,
      `FU${projectId.replaceAll("-", "").slice(0, 5).toUpperCase()}`,
      "File undo concurrency",
    ]
  );
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, "createdById") VALUES ($1, $2, 1, $3, $4)',
    [taskId, projectId, "File undo task", actorId]
  );
  await authPool.query(
    'INSERT INTO file_asset (id, "projectId", "taskId", "uploadedById", "originalName", "storageKey", "contentType", "sizeBytes") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [
      fileId,
      projectId,
      taskId,
      actorId,
      "undo.txt",
      `tasks/${fileId}/undo.txt`,
      "text/plain",
      12,
    ]
  );

  try {
    const receipt = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* removeFile() {
          const uploads = yield* Uploads;
          return yield* uploads.removeFile(actorId, fileId);
        }),
        uploadsLayer
      )
    );
    const undo = () =>
      runEffectResult(
        Effect.provide(
          Effect.gen(function* undoRemoval() {
            const uploads = yield* Uploads;
            yield* uploads.undoFileRemoval(actorId, receipt.undoId);
          }),
          uploadsLayer
        )
      );
    const outcomes = await Promise.all([undo(), undo(), undo()]);

    const succeeded = outcomes.filter((outcome) => outcome.ok);
    const rejected = outcomes.filter((outcome) => !outcome.ok);
    expect(succeeded).toHaveLength(1);
    for (const outcome of rejected) {
      expect(outcome).toMatchObject({ error: { code: "CONFLICT" }, ok: false });
    }
    const restored = await authPool.query(
      'SELECT "deletedAt" FROM file_asset WHERE id = $1',
      [fileId]
    );
    expect(restored.rows[0]?.deletedAt).toBeNull();
  } finally {
    await authPool.query('DELETE FROM undo_record WHERE "actorId" = $1', [
      actorId,
    ]);
    await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [
      actorId,
    ]);
    await authPool.query('DELETE FROM file_asset WHERE "projectId" = $1', [
      projectId,
    ]);
    await authPool.query('DELETE FROM task WHERE "projectId" = $1', [
      projectId,
    ]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [actorId]);
  }
});
