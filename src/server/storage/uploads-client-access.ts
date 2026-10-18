import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { Transaction } from "./uploads-internal";

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
export const CLOSED_CLIENT_BUG_STATUSES = new Set([
  "closed",
  "duplicate",
  "withdrawn",
]);

// A client may reach only the bug tasks of its own company, and only while
// the bug is still open.
export const assertClientBugTask = async (
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

export const fileHidden = () =>
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
