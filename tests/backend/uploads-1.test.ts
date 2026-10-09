import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import { authPool } from "../../src/server/auth/database";
import { Storage } from "../../src/server/storage/storage";
import { UploadsLive } from "../../src/server/storage/uploads";
import { Uploads } from "../../src/server/storage/uploads-contracts";

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
