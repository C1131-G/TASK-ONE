import { randomUUID } from "node:crypto";

import { Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { MimeTypeSchema } from "../core/input-schemas";
import { isUniqueConstraintViolation } from "../core/prisma-errors";
import { FinalizedFileSchema } from "./uploads-contracts";
import type { FinalizedFile } from "./uploads-contracts";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export const INTENT_LIFETIME_MS = 15 * 60 * 1000;
export const UNDO_LIFETIME_MS = 5 * 60 * 1000;
export const ORPHAN_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;
export const AvatarUploadInputSchema = Schema.Struct({
  contentType: Schema.Literals(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThan(0),
    Schema.isLessThanOrEqualTo(MAX_AVATAR_BYTES)
  ),
});
export const PreviewContentTypeSchema = Schema.Literals([
  "application/pdf",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type Role = "admin" | "employee";

export const mapError = (error: unknown): AppError => {
  if (error instanceof AppError) {
    return error;
  }
  if (isUniqueConstraintViolation(error)) {
    return new AppError({
      code: "CONFLICT",
      message: "The file or upload request already exists.",
    });
  }
  return new AppError({
    code: "UNAVAILABLE",
    message: "The file request could not be completed.",
  });
};

export const normalizeFileName = (input: string): string => {
  const name = input.replaceAll("\\", "/").split("/").at(-1)?.trim() ?? "";
  const hasControl = [...name].some((character) => {
    const point = character.codePointAt(0);
    return (
      point !== undefined && (point < 32 || (point >= 127 && point <= 159))
    );
  });
  if (
    !name ||
    name.length > 180 ||
    hasControl ||
    name === "." ||
    name === ".."
  ) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Choose a valid file name up to 180 characters long.",
    });
  }
  return name;
};

export const validateUploadInput = <
  Input extends {
    readonly fileName: string;
    readonly contentType: string;
    readonly sizeBytes: number;
  },
>(
  input: Input
): Input => {
  const fileName = normalizeFileName(input.fileName);
  const contentType = input.contentType.trim().toLowerCase();
  if (!Schema.is(MimeTypeSchema)(contentType)) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Choose a valid file content type.",
    });
  }
  if (
    !Number.isSafeInteger(input.sizeBytes) ||
    input.sizeBytes < 1 ||
    input.sizeBytes > MAX_UPLOAD_BYTES
  ) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Files must be between 1 byte and 50 MB.",
    });
  }
  return { ...input, contentType, fileName };
};

export const getActor = async (transaction: Transaction, actorId: string) => {
  const actor = await transaction.orm.public.User.where({ id: actorId })
    .select("id", "role", "mustChangePassword", "deactivatedAt")
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

export const getEditableTask = async (
  transaction: Transaction,
  actor: { id: string; role: string },
  taskId: string
) => {
  const task = await transaction.orm.public.Task.include("project")
    .where({ id: taskId })
    .first();
  if (!task) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "The task was not found.",
    });
  }
  if (task.archivedAt || task.project.archivedAt) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Archived work is read only.",
    });
  }
  if (actor.role === "admin" || task.createdById === actor.id) {
    return task;
  }
  const assignment = await transaction.orm.public.TaskAssignee.where({
    taskId,
    userId: actor.id,
  })
    .select("taskId")
    .first();
  if (!assignment) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "You cannot edit this task.",
    });
  }
  return task;
};

export const activeRole = async (actorId: string): Promise<Role> => {
  const actor = await db.orm.public.User.where({ id: actorId })
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
  return actor.role === "admin" ? "admin" : "employee";
};

export const toFinalizedFile = (file: {
  id: string;
  projectId: string;
  taskId: string | null;
  originalName: string;
  contentType: string | null;
  sizeBytes: bigint;
  copyState: string;
  uploadedById: string;
  createdAt: Date;
}): FinalizedFile => {
  if (!file.contentType) {
    throw new AppError({
      code: "CONFLICT",
      message: "The finalized file metadata is incomplete.",
    });
  }
  return {
    contentType: file.contentType,
    copyState: Schema.decodeUnknownSync(FinalizedFileSchema.fields.copyState)(
      file.copyState
    ),
    createdAt: file.createdAt.toISOString(),
    id: file.id,
    originalName: file.originalName,
    projectId: file.projectId,
    sizeBytes: Number(file.sizeBytes),
    taskId: file.taskId,
    uploadedById: file.uploadedById,
  };
};

export const addActivity = async (
  transaction: Transaction,
  actorId: string,
  taskId: string | null,
  projectId: string,
  action: string,
  details: Record<string, string>
) => {
  await transaction.orm.public.Activity.create({
    action,
    actorId,
    createdAt: new Date(),
    details,
    id: randomUUID(),
    projectId,
    taskId,
  });
};

// eslint-disable-next-line func-style -- Hoisting keeps this permission helper available to the upload Layer methods below.
export async function assertActiveFileLocation(
  transaction: Transaction,
  actorRole: string,
  taskId: string | null,
  projectId: string
): Promise<void> {
  if (taskId) {
    const task = await transaction.orm.public.Task.include("project")
      .where({ id: taskId })
      .first();
    if (!task) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "The task was not found.",
      });
    }
    if (task.archivedAt || task.project.archivedAt) {
      throw new AppError({
        code: "FORBIDDEN",
        message: "Archived work is read only.",
      });
    }
    return;
  }
  if (actorRole !== "admin") {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Only admins can manage standalone project files.",
    });
  }
  const project = await transaction.orm.public.Project.where({ id: projectId })
    .select("archivedAt")
    .first();
  if (!project || project.archivedAt) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Archived work is read only.",
    });
  }
}
