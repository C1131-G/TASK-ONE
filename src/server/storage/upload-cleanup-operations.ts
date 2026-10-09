import { and } from "@prisma/orm-postgres/orm-client";
import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import type { AppError } from "../core/action-result";
import type { StorageApi } from "./storage";
import * as internal from "./uploads-internal";

export const makeUploadCleanupOperations = (storage: StorageApi) => {
  const cleanupExpiredUploads = (): Effect.Effect<
    {
      readonly filesRemoved: number;
      readonly intentsRemoved: number;
      readonly orphansRemoved: number;
    },
    AppError
  > =>
    Effect.gen(function* cleanupExpiredUploadData() {
      const now = new Date();
      yield* Effect.tryPromise({
        catch: internal.mapError,
        try: () =>
          db.orm.public.IdempotencyKey.where((record) =>
            record.expiresAt.lte(now)
          ).deleteAll(),
      });
      const expiredIntents = yield* Effect.tryPromise({
        catch: internal.mapError,
        try: () =>
          db.orm.public.UploadIntent.where((intent) =>
            and(intent.state.eq("pending"), intent.expiresAt.lte(now))
          )
            .orderBy((intent) => intent.expiresAt.asc())
            .limit(100)
            .all(),
      });
      let intentsRemoved = 0;
      for (const intent of expiredIntents) {
        const updated = yield* Effect.tryPromise({
          catch: internal.mapError,
          try: () =>
            db.orm.public.UploadIntent.where({
              id: intent.id,
              state: "pending",
            }).updateAndCount({
              removedAt: now,
              state: "removed",
              updatedAt: now,
            }),
        });
        if (updated) {
          yield* storage.deleteObject(intent.objectKey);
          intentsRemoved += 1;
        }
      }

      const removalCutoff = new Date(now.getTime() - internal.UNDO_LIFETIME_MS);
      const expiredRemovedFiles = yield* Effect.tryPromise({
        catch: internal.mapError,
        try: () =>
          db.orm.public.FileAsset.where((file) =>
            file.deletedAt.lte(removalCutoff)
          )
            .orderBy((file) => file.deletedAt.asc())
            .limit(100)
            .all(),
      });
      let filesRemoved = 0;
      for (const file of expiredRemovedFiles) {
        const activeUndo = yield* Effect.tryPromise({
          catch: internal.mapError,
          try: () =>
            db.orm.public.UndoRecord.where((undo) =>
              and(
                undo.action.eq("file.remove"),
                undo.entityId.eq(file.id),
                undo.consumedAt.isNull(),
                undo.expiresAt.gt(now)
              )
            )
              .select("id")
              .first(),
        });
        if (activeUndo) {
          continue;
        }
        const deleted = yield* Effect.tryPromise({
          catch: internal.mapError,
          try: () =>
            db.orm.public.FileAsset.where((current) =>
              and(current.id.eq(file.id), current.deletedAt.lte(removalCutoff))
            ).delete(),
        });
        if (deleted) {
          yield* storage.deleteObject(file.storageKey);
          filesRemoved += 1;
        }
      }
      const { listObjects } = storage;
      if (!listObjects) {
        return { filesRemoved, intentsRemoved, orphansRemoved: 0 };
      }
      const [files, intents] = yield* Effect.tryPromise({
        catch: internal.mapError,
        try: () =>
          Promise.all([
            db.orm.public.FileAsset.select("storageKey").all(),
            db.orm.public.UploadIntent.where((intent) =>
              intent.state.neq("removed")
            )
              .select("objectKey")
              .all(),
          ]),
      });
      const knownKeys = new Set([
        ...files.map(({ storageKey }) => storageKey),
        ...intents.map(({ objectKey }) => objectKey),
      ]);
      const orphanCutoff = new Date(
        now.getTime() - internal.ORPHAN_GRACE_PERIOD_MS
      );
      const [taskObjects, copiedObjects] = yield* Effect.all(
        [listObjects("company/tasks/"), listObjects("company/files/")],
        { concurrency: 2 }
      );
      const orphanKeys = [...taskObjects, ...copiedObjects]
        .filter(
          ({ key, lastModified }) =>
            !knownKeys.has(key) &&
            lastModified !== null &&
            lastModified < orphanCutoff
        )
        .slice(0, 100)
        .map(({ key }) => key);
      yield* Effect.forEach(orphanKeys, (key) => storage.deleteObject(key), {
        concurrency: 10,
      });
      return {
        filesRemoved,
        intentsRemoved,
        orphansRemoved: orphanKeys.length,
      };
    });

  return { cleanupExpiredUploads };
};
