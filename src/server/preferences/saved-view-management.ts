import { randomUUID } from "node:crypto";

import { or } from "@prisma/orm-postgres/orm-client";
import { Context, Effect, Layer, Schema } from "effect";

import type { CodecTypes } from "@/src/prisma/contract.d";
import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";

export type SavedViewType =
  | "board"
  | "list"
  | "table"
  | "calendar"
  | "timeline";

export interface SavedViewInput {
  readonly name: string;
  readonly type: SavedViewType;
  readonly projectId: string | null;
  readonly filters: unknown;
  readonly sort: unknown;
  readonly groupBy: string | null;
  readonly hiddenColumns: unknown;
  readonly isShared: boolean;
}

export interface SavedViewSummary extends SavedViewInput {
  readonly id: string;
  readonly userId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const SavedViewSummarySchema = Schema.Struct({
  createdAt: Schema.String,
  filters: Schema.Unknown,
  groupBy: Schema.NullOr(Schema.String),
  hiddenColumns: Schema.Unknown,
  id: Schema.String,
  isShared: Schema.Boolean,
  name: Schema.String,
  projectId: Schema.NullOr(Schema.String),
  sort: Schema.Unknown,
  type: Schema.Literals(["board", "list", "table", "calendar", "timeline"]),
  updatedAt: Schema.String,
  userId: Schema.String,
});

interface Actor {
  readonly role: string;
  readonly deactivatedAt: Date | null;
  readonly mustChangePassword: boolean;
}

type JsonInput = CodecTypes["pg/jsonb@1"]["input"];

const SavedViewJsonSchema = Schema.Json.check(
  Schema.makeFilter((value) =>
    Buffer.byteLength(JSON.stringify(value), "utf-8") <= 12_000
      ? undefined
      : "Each view setting must be smaller than 12 KB."
  )
);

const SavedViewInputSchema = Schema.Struct({
  filters: SavedViewJsonSchema,
  groupBy: Schema.NullOr(Schema.String),
  hiddenColumns: SavedViewJsonSchema,
  isShared: Schema.Boolean,
  name: Schema.String,
  projectId: Schema.NullOr(Schema.String.check(Schema.isUUID())),
  sort: SavedViewJsonSchema,
  type: Schema.Literals(["board", "list", "table", "calendar", "timeline"]),
});

const mapError = (error: unknown): AppError =>
  error instanceof AppError
    ? error
    : new AppError({
        code: "UNAVAILABLE",
        message: "The saved view could not be updated.",
      });

const validateInput = (
  input: SavedViewInput
): {
  readonly name: string;
  readonly projectId: string | null;
  readonly groupBy: string | null;
  readonly filters: JsonInput;
  readonly sort: JsonInput;
  readonly hiddenColumns: JsonInput;
  readonly type: SavedViewType;
  readonly isShared: boolean;
} => {
  let decoded: typeof SavedViewInputSchema.Type;
  try {
    decoded = Schema.decodeUnknownSync(SavedViewInputSchema)(input);
  } catch {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "The saved view settings are invalid.",
    });
  }
  const name = decoded.name.trim();
  const groupBy = decoded.groupBy?.trim() || null;
  if (!name || name.length > 80 || (groupBy && groupBy.length > 80)) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "View names and grouping values must be 1 to 80 characters.",
    });
  }

  return {
    filters: decoded.filters,
    groupBy,
    hiddenColumns: decoded.hiddenColumns,
    isShared: decoded.isShared,
    name,
    projectId: decoded.projectId,
    sort: decoded.sort,
    type: decoded.type,
  };
};

const requireActor = async (userId: string): Promise<Actor> => {
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

const toSummary = (view: {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly type: SavedViewType;
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
  filters: view.filters,
  groupBy: view.groupBy,
  hiddenColumns: view.hiddenColumns,
  id: view.id,
  isShared: view.isShared,
  name: view.name,
  projectId: view.projectId,
  sort: view.sort,
  type: view.type,
  updatedAt: view.updatedAt.toISOString(),
  userId: view.userId,
});

const validateSharedAccess = (actor: Actor, isShared: boolean): void => {
  if (isShared && actor.role !== "admin") {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Only admins can publish shared views.",
    });
  }
};

const validateProject = async (projectId: string | null): Promise<void> => {
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

const canManage = (
  actor: Actor,
  userId: string,
  view: {
    readonly userId: string;
    readonly isShared: boolean;
  }
): boolean =>
  view.userId === userId || (view.isShared && actor.role === "admin");

export class SavedViewManagement extends Context.Service<
  SavedViewManagement,
  {
    readonly listViews: (
      userId: string
    ) => Effect.Effect<readonly SavedViewSummary[], AppError>;
    readonly createView: (
      userId: string,
      input: SavedViewInput
    ) => Effect.Effect<SavedViewSummary, AppError>;
    readonly updateView: (
      userId: string,
      viewId: string,
      input: SavedViewInput
    ) => Effect.Effect<SavedViewSummary, AppError>;
    readonly deleteView: (
      userId: string,
      viewId: string
    ) => Effect.Effect<void, AppError>;
  }
>()("metsys/server/SavedViewManagement") {}

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
