import { randomUUID } from "node:crypto";

import { or } from "@prisma/orm-postgres/orm-client";
import { Effect, Layer } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { SavedViewManagement } from "./saved-view-contracts";
import {
  canManage,
  requireActor,
  toSummary,
  validateProject,
  validateSharedAccess,
} from "./saved-view-internal";
import { mapError, validateInput } from "./saved-view-validation";

export const SavedViewManagementLive = Layer.succeed(SavedViewManagement, {
  createView: (userId, input) =>
    Effect.tryPromise({
      catch: mapError,
      try: async () => {
        const values = validateInput(input);
        const actor = await requireActor(userId);
        validateSharedAccess(actor, values.isShared);
        await validateProject(values.projectId);
        const view = await db.orm.public.SavedView.create({
          ...values,
          createdAt: new Date(),
          id: randomUUID(),
          updatedAt: new Date(),
          userId,
        });
        return toSummary(view);
      },
    }),
  deleteView: (userId, viewId) =>
    Effect.tryPromise({
      catch: mapError,
      try: async () => {
        const actor = await requireActor(userId);
        const view = await db.orm.public.SavedView.where({ id: viewId })
          .select("id", "userId", "isShared")
          .first();
        if (!view) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The saved view does not exist.",
          });
        }
        if (!canManage(actor, userId, view)) {
          throw new AppError({
            code: "FORBIDDEN",
            message: "You cannot remove this saved view.",
          });
        }
        await db.orm.public.SavedView.where({ id: viewId }).delete();
      },
    }),
  listViews: (userId) =>
    Effect.tryPromise({
      catch: mapError,
      try: async () => {
        await requireActor(userId);
        const views = await db.orm.public.SavedView.where((view) =>
          or(view.userId.eq(userId), view.isShared.eq(true))
        )
          .orderBy((view) => view.updatedAt.desc())
          .all();
        return views
          .toSorted(
            (left, right) => Number(right.isShared) - Number(left.isShared)
          )
          .map(toSummary);
      },
    }),
  updateView: (userId, viewId, input) =>
    Effect.tryPromise({
      catch: mapError,
      try: async () => {
        const values = validateInput(input);
        const actor = await requireActor(userId);
        validateSharedAccess(actor, values.isShared);
        await validateProject(values.projectId);
        const current = await db.orm.public.SavedView.where({ id: viewId })
          .select("id", "userId", "isShared")
          .first();
        if (!current) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The saved view does not exist.",
          });
        }
        if (!canManage(actor, userId, current)) {
          throw new AppError({
            code: "FORBIDDEN",
            message: "You cannot edit this saved view.",
          });
        }
        const updated = await db.orm.public.SavedView.where({
          id: viewId,
        }).update({
          ...values,
          updatedAt: new Date(),
        });
        if (!updated) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The saved view does not exist.",
          });
        }
        return toSummary(updated);
      },
    }),
});
