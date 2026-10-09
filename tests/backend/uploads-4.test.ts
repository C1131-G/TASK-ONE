import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import { authPool } from "../../src/server/auth/database";
import { Storage } from "../../src/server/storage/storage";
import { UploadsLive } from "../../src/server/storage/uploads";
import { Uploads } from "../../src/server/storage/uploads-contracts";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

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
