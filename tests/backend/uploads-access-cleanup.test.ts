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

it("denies employees access to standalone project files before signing a URL", async () => {
  const suffix = randomUUID();
  const actorId = randomUUID();
  const projectId = randomUUID();
  const fileId = randomUUID();
  const email = `${actorId}@standalone-file-test.example`;
  let signed = false;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [actorId, "Employee", email, "employee"]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `S${suffix.slice(0, 6)}`, "Standalone file project"]
  );
  await authPool.query(
    'INSERT INTO file_asset (id, "projectId", "uploadedById", "originalName", "storageKey", "contentType", "sizeBytes") VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [
      fileId,
      projectId,
      actorId,
      "private.pdf",
      `standalone/${fileId}`,
      "application/pdf",
      10,
    ]
  );

  const storageLayer = Layer.succeed(
    Storage,
    Storage.of({
      copyObject: () => Effect.void,
      deleteObject: () => Effect.void,
      signDownload: () => {
        signed = true;
        return Effect.succeed("https://private.example/download");
      },
      signPreview: () => Effect.succeed("https://private.example/preview"),
      signUpload: () => Effect.succeed("https://private.example/upload"),
      verifyObject: () => Effect.void,
    })
  );

  try {
    const program = Effect.gen(function* program() {
      const uploads = yield* Uploads;
      return yield* uploads.signedDownload(actorId, fileId);
    });
    const result = await runEffectResult(
      Effect.provide(program, Layer.provide(UploadsLive, storageLayer))
    );

    expect(result).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
    expect(signed).toBe(false);
  } finally {
    await authPool.query("DELETE FROM file_asset WHERE id = $1", [fileId]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [actorId]);
  }
});

it("cleans expired upload intents through the upload service", async () => {
  const suffix = randomUUID();
  const actorId = randomUUID();
  const projectId = randomUUID();
  const taskId = randomUUID();
  const intentId = randomUUID();
  const fileId = randomUUID();
  const objectKey = `expired/${intentId}`;
  const removedFileKey = `removed/${fileId}`;
  const orphanKey = `tasks/orphaned-object-${suffix}`;
  const email = `${actorId}@expired-upload-test.example`;
  const deletedKeys: string[] = [];
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [actorId, "Upload Owner", email, "employee"]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `E${suffix.slice(0, 6)}`, "Expired upload project"]
  );
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, "createdById") VALUES ($1, $2, 1, $3, $4)',
    [taskId, projectId, "Expired upload task", actorId]
  );
  await authPool.query(
    'INSERT INTO upload_intent (id, "ownerId", "taskId", "projectId", "objectKey", "fileName", "contentType", "sizeBytes", state, "expiresAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now() - interval \'1 hour\')',
    [
      intentId,
      actorId,
      taskId,
      projectId,
      objectKey,
      "expired.pdf",
      "application/pdf",
      20,
      "pending",
    ]
  );
  await authPool.query(
    'INSERT INTO file_asset (id, "projectId", "taskId", "uploadedById", "originalName", "storageKey", "contentType", "sizeBytes", "deletedAt", "deletedById") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now() - interval \'1 hour\', $4)',
    [
      fileId,
      projectId,
      taskId,
      actorId,
      "removed.pdf",
      removedFileKey,
      "application/pdf",
      20,
    ]
  );

  const storageLayer = Layer.succeed(
    Storage,
    Storage.of({
      copyObject: () => Effect.void,
      deleteObject: (key) => {
        deletedKeys.push(key);
        return Effect.void;
      },
      listObjects: (prefix) =>
        Effect.succeed(
          prefix === "company/tasks/"
            ? [
                {
                  key: orphanKey,
                  lastModified: new Date("2020-01-01T00:00:00.000Z"),
                },
              ]
            : []
        ),
      signDownload: () => Effect.succeed("https://private.example/download"),
      signPreview: () => Effect.succeed("https://private.example/preview"),
      signUpload: () => Effect.succeed("https://private.example/upload"),
      verifyObject: () => Effect.void,
    })
  );

  try {
    const program = Effect.gen(function* program() {
      const uploads = yield* Uploads;
      return yield* uploads.cleanupExpiredUploads();
    });
    const result = await Effect.runPromise(
      Effect.provide(program, Layer.provide(UploadsLive, storageLayer))
    );

    expect(deletedKeys).toContain(objectKey);
    expect(deletedKeys).toContain(removedFileKey);
    expect(deletedKeys).toContain(orphanKey);
    expect(result.filesRemoved).toBeGreaterThanOrEqual(1);
    expect(result.intentsRemoved).toBe(1);
    expect(result.orphansRemoved).toBe(1);
  } finally {
    await authPool.query('DELETE FROM file_asset WHERE "projectId" = $1', [
      projectId,
    ]);
    await authPool.query('DELETE FROM upload_intent WHERE "ownerId" = $1', [
      actorId,
    ]);
    await authPool.query("DELETE FROM task WHERE id = $1", [taskId]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [actorId]);
  }
});
