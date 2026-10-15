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
export type Role = "admin" | "employee" | "client";

// What a client account may attach to a bug it can see.
export const CLIENT_UPLOAD_CONTENT_TYPES: ReadonlySet<string> = new Set([
  "application/pdf",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
]);
export const CLIENT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const CLIENT_MAX_FILES_PER_BUG = 10;
const CLOSED_CLIENT_BUG_STATUSES = new Set([
  "closed",
  "duplicate",
  "withdrawn",
]);

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
    .select(
      "id",
      "role",
      "mustChangePassword",
      "deactivatedAt",
      "clientCompanyId"
    )
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

// A client may reach only the bug tasks of its own company, and only while
// the bug is still open.
const assertClientBugTask = async (
  transaction: Transaction,
  actor: { clientCompanyId: string | null },
  taskId: string
): Promise<void> => {
  const bug = await transaction.orm.public.BugReport.where({ taskId })
    .select("clientCompanyId", "status")
    .first();
  if (
    !bug ||
    !actor.clientCompanyId ||
    bug.clientCompanyId !== actor.clientCompanyId
  ) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "The task was not found.",
    });
  }
  if (CLOSED_CLIENT_BUG_STATUSES.has(bug.status)) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Closed bugs are read only.",
    });
  }
};

export const getEditableTask = async (
  transaction: Transaction,
  actor: { id: string; role: string; clientCompanyId?: string | null },
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
  if (actor.role === "client") {
    await assertClientBugTask(
      transaction,
      { clientCompanyId: actor.clientCompanyId ?? null },
      taskId
    );
    return task;
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

// Clients have stricter limits than staff: allowed types, a smaller file size,
// and a cap on the files a bug can hold.
export const assertClientUploadAllowed = async (
  transaction: Transaction,
  taskId: string,
  upload: { readonly contentType: string; readonly sizeBytes: number }
): Promise<void> => {
  if (!CLIENT_UPLOAD_CONTENT_TYPES.has(upload.contentType)) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Attach images, PDF files, or MP4 videos.",
    });
  }
  if (upload.sizeBytes > CLIENT_MAX_UPLOAD_BYTES) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Files must be 10 MB or smaller.",
    });
  }
  const now = new Date();
  const [files, intents] = await Promise.all([
    transaction.orm.public.FileAsset.where({ deletedAt: null, taskId })
      .select("id")
      .all(),
    transaction.orm.public.UploadIntent.where({ state: "pending", taskId })
      .select("expiresAt")
      .all(),
  ]);
  const pending = intents.filter(({ expiresAt }) => expiresAt > now).length;
  if (files.length + pending >= CLIENT_MAX_FILES_PER_BUG) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "A bug can have at most 10 attachments.",
    });
  }
};

const fileHidden = () =>
  new AppError({ code: "NOT_FOUND", message: "The file was not found." });

// Clients read only files that client-company users attached to their own
// company's bugs; internal evidence uploaded by staff stays hidden.
export const assertClientCanReadFile = async (
  actor: { readonly clientCompanyId: string | null },
  file: { readonly taskId: string | null; readonly uploadedById: string }
): Promise<void> => {
  if (!actor.clientCompanyId || !file.taskId) {
    throw fileHidden();
  }
  const [bug, uploader] = await Promise.all([
    db.orm.public.BugReport.where({ taskId: file.taskId })
      .select("clientCompanyId")
      .first(),
    db.orm.public.User.where({ id: file.uploadedById })
      .select("clientCompanyId")
      .first(),
  ]);
  if (
    bug?.clientCompanyId !== actor.clientCompanyId ||
    uploader?.clientCompanyId !== actor.clientCompanyId
  ) {
    throw fileHidden();
  }
};

export const activeActor = async (
  actorId: string
): Promise<{
  readonly role: Role;
  readonly clientCompanyId: string | null;
}> => {
  const actor = await db.orm.public.User.where({ id: actorId })
    .select("role", "deactivatedAt", "mustChangePassword", "clientCompanyId")
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
  if (actor.role === "client") {
    return { clientCompanyId: actor.clientCompanyId, role: "client" };
  }
  return {
    clientCompanyId: null,
    role: actor.role === "admin" ? "admin" : "employee",
  };
};

export const activeRole = async (actorId: string): Promise<Role> => {
  const actor = await activeActor(actorId);
  return actor.role;
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
