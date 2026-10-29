import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Exit, Layer } from "effect";

import { authPool } from "../../src/server/auth/database";
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
    listObjects: () => Effect.succeed([]),
    signDownload: () => Effect.succeed("https://private.example/download"),
    signPreview: () => Effect.succeed("https://private.example/preview"),
    signUpload: () => Effect.succeed("https://private.example/upload"),
    verifyObject: () => Effect.void,
  })
);

const remove = (actorId: string, fileId: string) =>
  Effect.runPromiseExit(
    Effect.provide(
      Effect.gen(function* run() {
        const uploads = yield* Uploads;
        return yield* uploads.removeFile(actorId, fileId);
      }),
      Layer.provide(UploadsLive, storageLayer)
    )
  );

const refusalOf = (exit: Exit.Exit<unknown, unknown>): string => {
  if (Exit.isSuccess(exit)) {
    return "removed";
  }
  const failure = JSON.stringify(exit.cause);
  return failure.includes("CONFLICT") ? "CONFLICT" : failure;
};

// An approval request lists the files the client is asked to look at. Taking
// one away would change what the client agreed to, so it stays until the
// request is gone, as bug evidence does.
it("keeps a file that an approval request lists, and still removes any other", async () => {
  const suffix = randomUUID();
  const adminId = randomUUID();
  const projectId = randomUUID();
  const taskId = randomUUID();
  const companyId = randomUUID();
  const requestId = randomUUID();
  const listedFileId = randomUUID();
  const plainFileId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [adminId, "File Admin", `${adminId}@remove-test.example`, "admin"]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `R${suffix.slice(0, 6)}`, "Remove project"]
  );
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, "createdById") VALUES ($1, $2, 1, $3, $4)',
    [taskId, projectId, "Remove task", adminId]
  );
  await authPool.query(
    'INSERT INTO client_company (id, name, "createdById", version) VALUES ($1, $2, $3, 1)',
    [companyId, `Remove company ${suffix}`, adminId]
  );
  const insertFile = (id: string, name: string) =>
    authPool.query(
      `INSERT INTO file_asset (id, "projectId", "taskId", "uploadedById", "originalName", "storageKey", "contentType", "sizeBytes")
       VALUES ($1, $2, $3, $4, $5, $6, 'application/pdf', 20)`,
      [id, projectId, taskId, adminId, name, `files/${id}`]
    );
  await insertFile(listedFileId, "listed.pdf");
  await insertFile(plainFileId, "plain.pdf");
  await authPool.query(
    `INSERT INTO approval_request (id, "projectId", "companyId", "taskId", "subjectKey", "subjectTitle", version, message, status, "requestedById", "requestedAt")
     VALUES ($1, $2, $3, $4, $5, 'Design', 1, 'Please review.', 'pending', $6, now())`,
    [
      requestId,
      projectId,
      companyId,
      taskId,
      `task:${taskId}:${requestId}`,
      adminId,
    ]
  );
  await authPool.query(
    'INSERT INTO approval_request_file (id, "requestId", "fileId") VALUES ($1, $2, $3)',
    [randomUUID(), requestId, listedFileId]
  );

  const listed = await remove(adminId, listedFileId);
  const plain = await remove(adminId, plainFileId);
  const after = await authPool.query(
    'SELECT "deletedAt" FROM file_asset WHERE id = $1',
    [listedFileId]
  );
  const [stillThere] = after.rows as { deletedAt: Date | null }[];

  expect(refusalOf(listed)).toBe("CONFLICT");
  expect(stillThere?.deletedAt).toBeNull();
  expect(refusalOf(plain)).toBe("removed");
});
