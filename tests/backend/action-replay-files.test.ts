/* eslint-disable no-unused-vars */
import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import {
  authPool,
  callAs,
  EMAIL_DOMAIN,
  ids,
  nextKey,
  replay,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import type { ActionFunction, Persona } from "./support/action-harness";

const calendar = await import("../../features/calendar/calendar-actions");
const comments = await import("../../features/tasks/actions/tasks-comments");
const companySettings =
  await import("../../features/settings/settings-actions");
const dashboard = await import("../../features/dashboard/dashboard-queries");
const discovery = await import("../../features/discovery/discovery-actions");
const employees = await import("../../features/people/people-actions");
const jobs = await import("../../features/settings/settings-queries");
const labels = await import("../../features/tasks/actions/tasks-labels");
const notifications =
  await import("../../features/notifications/notifications-actions");
const password = await import("../../features/user/actions/user-password");
const personalPreferences =
  await import("../../features/user/actions/user-personal-preferences");
const projects = await import("../../features/projects/projects-actions");
const savedViews =
  await import("../../features/projects/actions/projects-saved-views");
const sessions = await import("../../features/user/actions/user-sessions");
const subtasks = await import("../../features/tasks/actions/tasks-subtasks");
const tasks = await import("../../features/tasks/tasks-actions");
const teams = await import("../../features/people/actions/people-teams");
const uploads = await import("../../features/files/files-actions");
const { Idempotency, IdempotencyLive } =
  await import("../../src/server/core/idempotency");
const { Storage } = await import("../../src/server/storage/storage");
const { AvatarUploadResultSchema, FinalizedFileSchema, Uploads } =
  await import("../../src/server/storage/uploads-contracts");
const { UploadsLive } = await import("../../src/server/storage/uploads");

const unique = (): string => randomUUID().replaceAll("-", "").slice(0, 8);
const projectKey = (): string => `R${unique().slice(0, 6)}`.toUpperCase();

const taskVersion = async (taskId: string): Promise<number> => {
  const rows = await authPool.query("SELECT version FROM task WHERE id = $1", [
    taskId,
  ]);
  return rows.rows[0]?.version;
};

interface Versioned {
  readonly id: string;
  readonly version: number;
}
interface VersionOnly {
  readonly version: number;
}
interface SubtaskResult {
  readonly parentVersion: number;
  readonly subtask: { readonly id: string };
}

const state: {
  copyProjectId: string;
  projectId: string;
  taskId: string;
} = { copyProjectId: "", projectId: "", taskId: "" };

beforeAll(async () => {
  await setupHarness();
  state.projectId = ids.projectId;
  state.taskId = ids.taskId;
});
afterAll(teardownHarness);

it("replays every file mutation that does not return a signed URL", async () => {
  await replay("renameFileAction", "owner", uploads.renameFileAction, {
    fileId: ids.fileId,
    fileName: "replay-renamed.txt",
  });
  await replay("duplicateFileAction", "owner", uploads.duplicateFileAction, {
    fileId: ids.fileId,
  });
  const removal = await replay(
    "removeFileAction",
    "owner",
    uploads.removeFileAction,
    { fileId: ids.fileId }
  );
  await replay(
    "undoFileRemovalAction",
    "owner",
    uploads.undoFileRemovalAction,
    {
      undoId: removal.undoId,
    }
  );
});

it("replays upload and avatar finalization without verifying storage twice", async () => {
  const ownerId = personaId("owner");
  let verifications = 0;
  const storageLayer = Layer.succeed(
    Storage,
    Storage.of({
      copyObject: () => Effect.void,
      deleteObject: () => Effect.void,
      signDownload: () => Effect.succeed("https://private.example/download"),
      signPreview: () => Effect.succeed("https://private.example/preview"),
      signUpload: () => Effect.succeed("https://private.example/upload"),
      verifyObject: () => {
        verifications += 1;
        return Effect.void;
      },
    })
  );
  const layers = Layer.mergeAll(
    IdempotencyLive,
    Layer.provide(UploadsLive, storageLayer)
  );

  const outcome = await Effect.runPromise(
    Effect.provide(
      Effect.gen(function* finalizeTwice() {
        const idempotency = yield* Idempotency;
        const service = yield* Uploads;
        const taskIntent = yield* service.requestTaskUpload(ownerId, {
          contentType: "application/pdf",
          fileName: "replay.pdf",
          sizeBytes: 2048,
          taskId: ids.taskId,
        });
        const finalize = () =>
          idempotency.run({
            actorId: ownerId,
            execute: () =>
              service.finalizeUpload(ownerId, taskIntent.uploadIntentId),
            input: { uploadIntentId: taskIntent.uploadIntentId },
            key: "upload-finalize-replay-0001",
            operation: "upload.finalize",
            resultSchema: FinalizedFileSchema,
          });
        const file = yield* finalize();
        const fileReplay = yield* finalize();
        const verificationsAfterFile = verifications;

        const avatarIntent = yield* service.requestAvatarUpload(ownerId, {
          contentType: "image/png",
          sizeBytes: 1024,
        });
        const finalizeAvatar = () =>
          idempotency.run({
            actorId: ownerId,
            execute: () =>
              service.finalizeAvatarUpload(
                ownerId,
                avatarIntent.uploadIntentId
              ),
            input: { uploadIntentId: avatarIntent.uploadIntentId },
            key: "avatar-finalize-replay-0001",
            operation: "avatar.finalize",
            resultSchema: AvatarUploadResultSchema,
          });
        const avatar = yield* finalizeAvatar();
        const avatarReplay = yield* finalizeAvatar();
        return {
          avatar,
          avatarReplay,
          file,
          fileReplay,
          verificationsAfterFile,
        };
      }),
      layers
    )
  );

  expect(outcome.fileReplay).toEqual(outcome.file);
  expect(outcome.avatarReplay).toEqual(outcome.avatar);
  // One storage check per finalization, not one per request.
  expect(outcome.verificationsAfterFile).toBe(1);
  expect(verifications).toBe(2);
});
