import { Schema } from "effect";

import type { RouteDefinition } from "./route-definition";

// Attachments: signed uploads, finalization, previews and downloads.
// Owned by one branch, so adding routes here never conflicts with the others.
// This file imports nothing from the server, so limits are spelled out here
// and a test decodes real responses against it.

const Uuid = Schema.String.check(Schema.isUUID());

// The web lets any file up to 50 MB through for staff. Clients are held to a
// smaller size and a short list of types by the upload service itself.
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const MEDIA_TYPE = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/iu;
const MAX_FILE_NAME_LENGTH = 180;
const MAX_MEDIA_TYPE_LENGTH = 255;

const UploadFields = {
  contentType: Schema.String.check(
    Schema.isMaxLength(MAX_MEDIA_TYPE_LENGTH),
    Schema.isPattern(MEDIA_TYPE, { message: "Enter a valid media type." })
  ),
  fileName: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(MAX_FILE_NAME_LENGTH)
  ),
  sizeBytes: Schema.Number.check(
    Schema.isInt(),
    Schema.isBetween({ maximum: MAX_UPLOAD_BYTES, minimum: 1 })
  ),
};

// The app PUTs the bytes to `uploadUrl` with these headers, before
// `expiresAt`, then finalizes the intent.
export const UploadTicketSchema = Schema.Struct({
  expiresAt: Schema.String,
  requiredHeaders: Schema.Struct({
    "content-type": Schema.String,
    "if-none-match": Schema.Literal("*"),
  }),
  uploadIntentId: Uuid,
  uploadUrl: Schema.String,
});

// A file as the app lists it: what the web shows, plus the id the download
// routes take and whether the preview route will serve it inline.
export const AttachmentFileSchema = Schema.Struct({
  contentType: Schema.String,
  createdAt: Schema.String,
  id: Uuid,
  name: Schema.String,
  previewable: Schema.Boolean,
  sizeBytes: Schema.Number,
  taskId: Schema.NullOr(Uuid),
  uploadedBy: Schema.Struct({ id: Schema.String, name: Schema.String }),
});

const UploadIntentParams = Schema.Struct({ uploadIntentId: Uuid });

export const requestWorkspaceUploadRoute = {
  body: Schema.Struct({ ...UploadFields, taskId: Uuid }),
  data: UploadTicketSchema,
  idempotency: "none",
  method: "post",
  operationId: "requestWorkspaceUpload",
  path: "/api/v1/workspace/attachments/uploads",
  summary: "A signed URL for uploading one file to a task.",
} as const satisfies RouteDefinition;

export const finalizeWorkspaceUploadRoute = {
  data: AttachmentFileSchema,
  method: "post",
  operationId: "finalizeWorkspaceUpload",
  params: UploadIntentParams,
  path: "/api/v1/workspace/attachments/uploads/{uploadIntentId}/finalize",
  summary: "Turns a finished upload into a file on the task.",
} as const satisfies RouteDefinition;

export const attachmentRoutes = [
  requestWorkspaceUploadRoute,
  finalizeWorkspaceUploadRoute,
] as const satisfies readonly RouteDefinition[];
