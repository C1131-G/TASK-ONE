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
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import type { ActionFunction, Persona } from "./support/action-harness";

const calendar = await import("../../app/actions/calendar");
const comments = await import("../../app/actions/comments");
const companySettings = await import("../../app/actions/company-settings");
const dashboard = await import("../../app/actions/dashboard");
const discovery = await import("../../app/actions/discovery");
const employees = await import("../../app/actions/employees");
const jobs = await import("../../app/actions/jobs");
const labels = await import("../../app/actions/labels");
const notifications = await import("../../app/actions/notifications");
const password = await import("../../app/actions/password");
const personalPreferences =
  await import("../../app/actions/personal-preferences");
const projects = await import("../../app/actions/projects");
const savedViews = await import("../../app/actions/saved-views");
const sessions = await import("../../app/actions/sessions");
const subtasks = await import("../../app/actions/subtasks");
const tasks = await import("../../app/actions/tasks");
const teams = await import("../../app/actions/teams");
const uploads = await import("../../app/actions/uploads");
const { Idempotency, IdempotencyLive } =
  await import("../../src/server/core/idempotency");
const { Storage } = await import("../../src/server/storage/storage");
const { AvatarUploadResultSchema, FinalizedFileSchema, Uploads } =
  await import("../../src/server/storage/uploads-contracts");
const { UploadsLive } = await import("../../src/server/storage/uploads");

const unique = (): string => randomUUID().replaceAll("-", "").slice(0, 8);
const projectKey = (): string => `R${unique().slice(0, 6)}`.toUpperCase();

/**
 * Runs an action twice with the same idempotency key and checks that the
 * second call replays the first result exactly instead of acting again.
 */
const replay = async <Data>(
  name: string,
  persona: Persona,
  action: unknown,
  input: Record<string, unknown>
): Promise<Data> => {
  const idempotencyKey = nextKey();
  const run = () =>
    callAs(persona, action as ActionFunction, { ...input, idempotencyKey });
  const first = await run();
  if (!first.ok) {
    throw new Error(
      `${name} failed on the first call: ${first.error?.code} ${first.error?.message}`
    );
  }
  const second = await run();
  if (!second.ok) {
    throw new Error(
      `${name} failed on the replay: ${second.error?.code} ${second.error?.message}`
    );
  }
  expect(JSON.stringify(second.data), `${name} replay result`).toBe(
    JSON.stringify(first.data)
  );
  return first.data as Data;
};

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
  const removal = await replay<{ undoId: string }>(
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
