import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import { authPool } from "../../src/server/auth/database";
import { AppError } from "../../src/server/core/action-result";
import { Storage } from "../../src/server/storage/storage";
import { UploadsLive } from "../../src/server/storage/uploads";
import { Uploads } from "../../src/server/storage/uploads-contracts";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

it("queues a private file copy and makes the duplicate downloadable only after the worker finishes", async () => {
  const suffix = randomUUID();
  const actorId = randomUUID();
  const projectId = randomUUID();
  const taskId = randomUUID();
  const sourceFileId = randomUUID();
  const sourceKey = `company/tasks/${taskId}/original`;
  const email = `${actorId}@file-copy-test.example`;
  const copiedKeys: string[] = [];
  let copyShouldFail = true;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [actorId, "Copy Owner", email, "employee"]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `FC${suffix.slice(0, 5)}`, "File copy project"]
  );
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, "createdById") VALUES ($1, $2, 1, $3, $4)',
    [taskId, projectId, "Copy source", actorId]
  );
  await authPool.query(
    'INSERT INTO file_asset (id, "projectId", "taskId", "uploadedById", "originalName", "storageKey", "contentType", "sizeBytes") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [
      sourceFileId,
      projectId,
      taskId,
      actorId,
      "design.pdf",
      sourceKey,
      "application/pdf",
      2048,
    ]
  );

  const storageLayer = Layer.succeed(
    Storage,
    Storage.of({
      copyObject: (from, to) => {
        copiedKeys.push(`${from} -> ${to}`);
        if (copyShouldFail) {
          return Effect.fail(
            new AppError({
              code: "UNAVAILABLE",
              message: "Private file storage is unavailable.",
            })
          );
        }
        return Effect.void;
      },
      deleteObject: () => Effect.void,
      signDownload: () => Effect.succeed("https://private.example/copied"),
      signPreview: () => Effect.succeed("https://private.example/preview"),
      signUpload: () => Effect.succeed("https://private.example/upload"),
      verifyObject: () => Effect.void,
    })
  );
  try {
    const copy = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* duplicate() {
          const uploads = yield* Uploads;
          return yield* uploads.requestFileCopy(actorId, sourceFileId);
        }),
        Layer.provide(UploadsLive, storageLayer)
      )
    );
    const beforeCopy = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* checkPendingCopy() {
          const uploads = yield* Uploads;
          return yield* Effect.exit(
            uploads.signedDownload(actorId, copy.fileId)
          );
        }),
        Layer.provide(UploadsLive, storageLayer)
      )
    );
    const job = await authPool.query(
      "SELECT payload FROM job WHERE kind = $1 AND payload->>'targetFileId' = $2",
      ["storage.copy-file", copy.fileId]
    );
    const payload = job.rows[0]?.payload as {
      sourceFileId: string;
      sourceKey: string;
      targetKey: string;
    };
    const failedCopy = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* failCopy() {
          const uploads = yield* Uploads;
          return yield* Effect.result(
            uploads.processFileCopy(
              payload.sourceFileId,
              copy.fileId,
              payload.sourceKey,
              payload.targetKey
            )
          );
        }),
        Layer.provide(UploadsLive, storageLayer)
      )
    );
    const afterFailure = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* checkFailedCopy() {
          const uploads = yield* Uploads;
          return yield* Effect.exit(
            uploads.signedDownload(actorId, copy.fileId)
          );
        }),
        Layer.provide(UploadsLive, storageLayer)
      )
    );
    copyShouldFail = false;
    const download = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* retryCopy() {
          const uploads = yield* Uploads;
          yield* uploads.processFileCopy(
            payload.sourceFileId,
            copy.fileId,
            payload.sourceKey,
            payload.targetKey
          );
          return yield* uploads.signedDownload(actorId, copy.fileId);
        }),
        Layer.provide(UploadsLive, storageLayer)
      )
    );

    expect(copy.state).toBe("pending");
    expect(beforeCopy._tag).toBe("Failure");
    expect(failedCopy._tag).toBe("Failure");
    expect(afterFailure._tag).toBe("Failure");
    expect(download).toBe("https://private.example/copied");
    expect(copiedKeys).toHaveLength(2);
    expect(copiedKeys[0]).toContain(sourceKey);
  } finally {
    await authPool.query(
      "DELETE FROM job WHERE kind = $1 AND payload->>'sourceFileId' = $2",
      ["storage.copy-file", sourceFileId]
    );
    await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [
      actorId,
    ]);
    await authPool.query('DELETE FROM file_asset WHERE "projectId" = $1', [
      projectId,
    ]);
    await authPool.query("DELETE FROM task WHERE id = $1", [taskId]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [actorId]);
  }
});
