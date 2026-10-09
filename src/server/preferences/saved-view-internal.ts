import { Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { SavedViewTypeSchema } from "./saved-view-contracts";
import type { SavedViewSummary } from "./saved-view-contracts";
import { SavedViewJsonSchema } from "./saved-view-validation";

interface Actor {
  readonly role: string;
  readonly deactivatedAt: Date | null;
  readonly mustChangePassword: boolean;
}

export const requireActor = async (userId: string): Promise<Actor> => {
  const actor = await db.orm.public.User.where({ id: userId })
    .select("role", "deactivatedAt", "mustChangePassword")
    .first();
  if (!actor || actor.deactivatedAt) {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Sign in to continue.",
    });
  }
  if (actor.mustChangePassword) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Change your password before continuing.",
    });
  }
  return actor;
};

export const toSummary = (view: {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly type: string;
  readonly projectId: string | null;
  readonly filters: unknown;
  readonly sort: unknown;
  readonly groupBy: string | null;
  readonly hiddenColumns: unknown;
  readonly isShared: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}): SavedViewSummary => ({
  createdAt: view.createdAt.toISOString(),
  filters: Schema.decodeUnknownSync(SavedViewJsonSchema)(view.filters),
  groupBy: view.groupBy,
  hiddenColumns: Schema.decodeUnknownSync(SavedViewJsonSchema)(
    view.hiddenColumns
  ),
  id: view.id,
  isShared: view.isShared,
  name: view.name,
  projectId: view.projectId,
  sort: Schema.decodeUnknownSync(SavedViewJsonSchema)(view.sort),
  type: Schema.decodeUnknownSync(SavedViewTypeSchema)(view.type),
  updatedAt: view.updatedAt.toISOString(),
  userId: view.userId,
});

export const validateSharedAccess = (actor: Actor, isShared: boolean): void => {
  if (isShared && actor.role !== "admin") {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Only admins can publish shared views.",
    });
  }
};

export const validateProject = async (
  projectId: string | null
): Promise<void> => {
  if (!projectId) {
    return;
  }
  const project = await db.orm.public.Project.where({
    archivedAt: null,
    id: projectId,
  })
    .select("id")
    .first();
  if (!project) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "The active project does not exist.",
    });
  }
};

export const canManage = (
  actor: Actor,
  userId: string,
  view: {
    readonly userId: string;
    readonly isShared: boolean;
  }
): boolean =>
  view.userId === userId || (view.isShared && actor.role === "admin");
