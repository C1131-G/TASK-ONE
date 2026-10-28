import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import { authPool } from "../../src/server/auth/database";
import { Storage } from "../../src/server/storage/storage";
import { UploadsLive } from "../../src/server/storage/uploads";
import { Uploads } from "../../src/server/storage/uploads-contracts";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

// A removed file that an approval request still lists cannot be deleted for
// good (the request keeps a hard reference). The job must skip it and carry on
// with the files behind it instead of failing on it every time it runs.
it("keeps cleaning when the oldest removed file is still on an approval request", async () => {
  const suffix = randomUUID();
  const actorId = randomUUID();
  const projectId = randomUUID();
  const taskId = randomUUID();
  const companyId = randomUUID();
  const requestId = randomUUID();
  const heldFileId = randomUUID();
  const plainFileId = randomUUID();
  const heldKey = `removed/held-${suffix}`;
  const plainKey = `removed/plain-${suffix}`;
  const deletedKeys: string[] = [];
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [actorId, "Cleanup Owner", `${actorId}@cleanup-test.example`, "employee"]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `C${suffix.slice(0, 6)}`, "Cleanup project"]
  );
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, "createdById") VALUES ($1, $2, 1, $3, $4)',
    [taskId, projectId, "Cleanup task", actorId]
  );
  await authPool.query(
    'INSERT INTO client_company (id, name, "createdById", version) VALUES ($1, $2, $3, 1)',
    [companyId, `Cleanup company ${suffix}`, actorId]
  );
  const insertFile = (id: string, key: string, hoursAgo: number) =>
    authPool.query(
      `INSERT INTO file_asset (id, "projectId", "taskId", "uploadedById", "originalName", "storageKey", "contentType", "sizeBytes", "deletedAt", "deletedById")
       VALUES ($1, $2, $3, $4, $5, $6, 'application/pdf', 20, now() - make_interval(hours => $7), $4)`,
      [id, projectId, taskId, actorId, `${key}.pdf`, key, hoursAgo]
    );
  // The held file was removed first, so it sorts ahead of the plain one.
  await insertFile(heldFileId, heldKey, 3);
  await insertFile(plainFileId, plainKey, 2);
  await authPool.query(
    `INSERT INTO approval_request (id, "projectId", "companyId", "taskId", "subjectKey", "subjectTitle", version, message, status, "requestedById", "requestedAt")
     VALUES ($1, $2, $3, $4, $5, 'Design', 1, 'Please review.', 'pending', $6, now())`,
    [
      requestId,
      projectId,
      companyId,
      taskId,
      `task:${taskId}:${requestId}`,
      actorId,
    ]
  );
  await authPool.query(
    'INSERT INTO approval_request_file (id, "requestId", "fileId") VALUES ($1, $2, $3)',
    [randomUUID(), requestId, heldFileId]
  );

  const storageLayer = Layer.succeed(
    Storage,
    Storage.of({
      copyObject: () => Effect.void,
      deleteObject: (key) => {
        deletedKeys.push(key);
        return Effect.void;
      },
      listObjects: () => Effect.succeed([]),
      signDownload: () => Effect.succeed("https://private.example/download"),
      signPreview: () => Effect.succeed("https://private.example/preview"),
      signUpload: () => Effect.succeed("https://private.example/upload"),
      verifyObject: () => Effect.void,
    })
  );

  try {
    const result = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* run() {
          const uploads = yield* Uploads;
          return yield* uploads.cleanupExpiredUploads();
        }),
        Layer.provide(UploadsLive, storageLayer)
      )
    );
    const remaining = await authPool.query<{ id: string }>(
      "SELECT id FROM file_asset WHERE id = ANY($1::uuid[])",
      [[heldFileId, plainFileId]]
    );

    expect(deletedKeys).toContain(plainKey);
    expect(deletedKeys).not.toContain(heldKey);
    expect(result.filesRemoved).toBeGreaterThanOrEqual(1);
    expect(remaining.rows.map(({ id }) => id)).toEqual([heldFileId]);
  } finally {
    await authPool.query(
      'DELETE FROM approval_request_file WHERE "requestId" = $1',
      [requestId]
    );
    await authPool.query("DELETE FROM approval_request WHERE id = $1", [
      requestId,
    ]);
    await authPool.query('DELETE FROM file_asset WHERE "projectId" = $1', [
      projectId,
    ]);
    await authPool.query("DELETE FROM client_company WHERE id = $1", [
      companyId,
    ]);
    await authPool.query("DELETE FROM task WHERE id = $1", [taskId]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [actorId]);
  }
});
