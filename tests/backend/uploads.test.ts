import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import { authPool } from "../../src/server/auth/database";
import { AppError, runEffectResult } from "../../src/server/core/action-result";
import { Storage } from "../../src/server/storage/storage";
import { Uploads, UploadsLive } from "../../src/server/storage/uploads";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

it("finalizes an upload after storage metadata verification", async () => {
  const suffix = randomUUID();
  const actorId = randomUUID();
  const projectId = randomUUID();
  const taskId = randomUUID();
  const email = `${actorId}@upload-test.example`;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [actorId, "Upload Owner", email, "employee"]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `U${suffix.slice(0, 6)}`, "Upload test project"]
  );
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, "createdById") VALUES ($1, $2, 1, $3, $4)',
    [taskId, projectId, "Upload test task", actorId]
  );

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

  try {
    const program = Effect.gen(function* program() {
      const uploads = yield* Uploads;
      const intent = yield* uploads.requestTaskUpload(actorId, {
        contentType: "application/pdf",
        fileName: "design.pdf",
        sizeBytes: 2048,
        taskId,
      });
      const file = yield* uploads.finalizeUpload(
        actorId,
        intent.uploadIntentId
      );
      const listedFiles = yield* uploads.listTaskFiles(actorId, taskId);
      const oversized = yield* Effect.exit(
        uploads.requestTaskUpload(actorId, {
          contentType: "application/pdf",
          fileName: "too-large.pdf",
          sizeBytes: 50 * 1024 * 1024 + 1,
          taskId,
        })
      );
      const undo = yield* uploads.removeFile(actorId, file.id);
      yield* uploads.undoFileRemoval(actorId, undo.undoId);
      const secondUndo = yield* Effect.exit(
        uploads.undoFileRemoval(actorId, undo.undoId)
      );
      const downloadUrl = yield* uploads.signedDownload(actorId, file.id);
      return { downloadUrl, file, listedFiles, oversized, secondUndo, undo };
    });
    const file = await Effect.runPromise(
      Effect.provide(program, Layer.provide(UploadsLive, storageLayer))
    );

    expect(file.file.taskId).toBe(taskId);
    expect(file.file.projectId).toBe(projectId);
    expect(file.file.originalName).toBe("design.pdf");
    expect(file.file.sizeBytes).toBe(2048);
    expect(file.listedFiles.map(({ id }) => id)).toContain(file.file.id);
    expect(file.undo.undoId).toBeTruthy();
    expect(file.oversized._tag).toBe("Failure");
    expect(file.downloadUrl).toBe("https://private.example/download");
    expect(file.secondUndo._tag).toBe("Failure");
  } finally {
    await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [
      actorId,
    ]);
    await authPool.query('DELETE FROM undo_record WHERE "actorId" = $1', [
      actorId,
    ]);
    await authPool.query('DELETE FROM file_asset WHERE "projectId" = $1', [
      projectId,
    ]);
    await authPool.query('DELETE FROM activity WHERE "projectId" = $1', [
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

it("lets admins upload and list standalone project files", async () => {
  const suffix = randomUUID();
  const adminId = randomUUID();
  const employeeId = randomUUID();
  const projectId = randomUUID();
  const adminEmail = `${adminId}@project-file-test.example`;
  const employeeEmail = `${employeeId}@project-file-test.example`;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'admin\', false), ($4, $5, $6, $6, \'employee\', false)',
    [
      adminId,
      "Project File Admin",
      adminEmail,
      employeeId,
      "Project File Employee",
      employeeEmail,
    ]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `F${suffix.slice(0, 6)}`, "Project file test"]
  );
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

  try {
    const program = Effect.gen(function* projectFileFlow() {
      const uploads = yield* Uploads;
      const ticket = yield* uploads.requestProjectUpload(adminId, {
        contentType: "application/pdf",
        fileName: "brief.pdf",
        projectId,
        sizeBytes: 512,
      });
      const file = yield* uploads.finalizeUpload(
        adminId,
        ticket.uploadIntentId
      );
      const files = yield* uploads.listProjectFiles(adminId, projectId);
      const previewUrl = yield* uploads.signedPreview(adminId, file.id);
      const employeeResult = yield* Effect.result(
        uploads.listProjectFiles(employeeId, projectId)
      );
      return { employeeResult, file, files, previewUrl, ticket };
    });
    const result = await Effect.runPromise(
      Effect.provide(program, Layer.provide(UploadsLive, storageLayer))
    );

    expect(result.ticket.uploadUrl).toBe("https://private.example/upload");
    expect(result.file.taskId).toBeNull();
    expect(result.files.map(({ originalName }) => originalName)).toContain(
      "brief.pdf"
    );
    expect(result.previewUrl).toBe("https://private.example/preview");
    expect(result.employeeResult._tag).toBe("Failure");
  } finally {
    await authPool.query('DELETE FROM file_asset WHERE "projectId" = $1', [
      projectId,
    ]);
    await authPool.query('DELETE FROM activity WHERE "projectId" = $1', [
      projectId,
    ]);
    await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [
      adminId,
    ]);
    await authPool.query('DELETE FROM upload_intent WHERE "ownerId" = $1', [
      adminId,
    ]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [adminId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [employeeId]);
  }
});

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

it("renames an owned task upload while retaining its storage key", async () => {
  const suffix = randomUUID();
  const actorId = randomUUID();
  const projectId = randomUUID();
  const taskId = randomUUID();
  const fileId = randomUUID();
  const storageKey = `tasks/${fileId}`;
  const email = `${actorId}@rename-upload-test.example`;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [actorId, "Upload Owner", email, "employee"]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `R${suffix.slice(0, 6)}`, "Rename upload project"]
  );
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, "createdById") VALUES ($1, $2, 1, $3, $4)',
    [taskId, projectId, "Rename upload task", actorId]
  );
  await authPool.query(
    'INSERT INTO file_asset (id, "projectId", "taskId", "uploadedById", "originalName", "storageKey", "contentType", "sizeBytes") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [
      fileId,
      projectId,
      taskId,
      actorId,
      "before.pdf",
      storageKey,
      "application/pdf",
      42,
    ]
  );
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

  try {
    const program = Effect.gen(function* program() {
      const uploads = yield* Uploads;
      return yield* uploads.renameFile(actorId, fileId, "after.pdf");
    });
    const result = await Effect.runPromise(
      Effect.provide(program, Layer.provide(UploadsLive, storageLayer))
    );

    expect(result.originalName).toBe("after.pdf");
    expect(result.id).toBe(fileId);
  } finally {
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

it("uploads, verifies, stores, and privately signs an employee avatar", async () => {
  const actorId = randomUUID();
  const email = `${actorId}@avatar-upload-test.example`;
  const verifiedKeys: string[] = [];
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [actorId, "Avatar Employee", email]
  );
  const storageLayer = Layer.succeed(
    Storage,
    Storage.of({
      copyObject: () => Effect.void,
      deleteObject: () => Effect.void,
      signDownload: (key) => Effect.succeed(`https://private.example/${key}`),
      signPreview: (key) => Effect.succeed(`https://private.example/${key}`),
      signUpload: (key) =>
        Effect.succeed(`https://private.example/upload/${key}`),
      verifyObject: (key) => {
        verifiedKeys.push(key);
        return Effect.void;
      },
    })
  );

  try {
    const program = Effect.gen(function* program() {
      const uploads = yield* Uploads;
      const ticket = yield* uploads.requestAvatarUpload(actorId, {
        contentType: "image/webp",
        sizeBytes: 2048,
      });
      const avatar = yield* uploads.finalizeAvatarUpload(
        actorId,
        ticket.uploadIntentId
      );
      const url = yield* uploads.signedAvatar(actorId, actorId);
      return { avatar, ticket, url };
    });
    const result = await Effect.runPromise(
      Effect.provide(program, Layer.provide(UploadsLive, storageLayer))
    );

    expect(result.avatar.contentType).toBe("image/webp");
    expect(result.avatar.sizeBytes).toBe(2048);
    expect(result.url).toContain("company/avatars/");
    if (result.url === null) {
      throw new Error(
        "The newly uploaded avatar should be visible to its owner."
      );
    }
    expect(verifiedKeys).toContain(
      result.url.slice("https://private.example/".length)
    );
  } finally {
    await authPool.query('DELETE FROM upload_intent WHERE "ownerId" = $1', [
      actorId,
    ]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [actorId]);
  }
});
