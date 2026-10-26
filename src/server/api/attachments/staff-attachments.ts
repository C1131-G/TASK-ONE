import { Effect } from "effect";

import {
  AttachmentFileSchema,
  downloadWorkspaceAttachmentRoute,
  finalizeWorkspaceUploadRoute,
  listWorkspaceAttachmentsRoute,
  previewWorkspaceAttachmentRoute,
  requestWorkspaceUploadRoute,
} from "../../../mobile-api/routes-attachments";
import { Idempotency } from "../../core/idempotency";
import { Uploads } from "../../storage/uploads-contracts";
import { asStaffAttachmentCaller } from "./caller";
import type { PathParams } from "./caller";
import { summarizeFile, summarizeFiles } from "./file-summary";
import { expiresIn, withUploadExpiry } from "./signed-urls";

// Staff get the same access the web gives: an admin, the creator or an
// assignee may upload to a task. Nothing is stored for replay because the
// answer carries a signed link.
export const requestWorkspaceUpload = (request: Request, params: PathParams) =>
  asStaffAttachmentCaller(
    requestWorkspaceUploadRoute,
    request,
    params,
    ({ input, user }) =>
      Effect.gen(function* requestUpload() {
        const uploads = yield* Uploads;
        const ticket = yield* uploads.requestTaskUpload(user.id, input.body);
        return withUploadExpiry(ticket);
      })
  );

// Finalizing checks the stored object, then creates the file. The service
// already answers a second finalize with the same file; the key makes the
// first retry replay the stored answer as well.
export const finalizeWorkspaceUpload = (request: Request, params: PathParams) =>
  asStaffAttachmentCaller(
    finalizeWorkspaceUploadRoute,
    request,
    params,
    ({ input, user }) =>
      Effect.gen(function* finalize() {
        const uploads = yield* Uploads;
        const idempotency = yield* Idempotency;
        const { uploadIntentId } = input.params;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () =>
            Effect.flatMap(
              uploads.finalizeUpload(user.id, uploadIntentId),
              ({ id }) => summarizeFile(id)
            ),
          input: { uploadIntentId },
          key: input.idempotencyKey,
          operation: "mobile.attachment.finalize",
          resultSchema: AttachmentFileSchema,
        });
      })
  );

// The same list the web shows on a task: every active file, to any employee.
export const listWorkspaceAttachments = (
  request: Request,
  params: PathParams
) =>
  asStaffAttachmentCaller(
    listWorkspaceAttachmentsRoute,
    request,
    params,
    ({ input, user }) =>
      Effect.gen(function* list() {
        const uploads = yield* Uploads;
        const files = yield* uploads.listTaskFiles(user.id, input.query.taskId);
        return { items: yield* summarizeFiles(files.map(({ id }) => id)) };
      })
  );

// The link is signed at request time, after the storage layer checks the
// caller may open the file, so a removed file never gets one.
export const downloadWorkspaceAttachment = (
  request: Request,
  params: PathParams
) =>
  asStaffAttachmentCaller(
    downloadWorkspaceAttachmentRoute,
    request,
    params,
    ({ input, user }) =>
      Effect.gen(function* download() {
        const uploads = yield* Uploads;
        const url = yield* uploads.signedDownload(user.id, input.params.fileId);
        return { expiresAt: expiresIn("download"), url };
      })
  );

export const previewWorkspaceAttachment = (
  request: Request,
  params: PathParams
) =>
  asStaffAttachmentCaller(
    previewWorkspaceAttachmentRoute,
    request,
    params,
    ({ input, user }) =>
      Effect.gen(function* preview() {
        const uploads = yield* Uploads;
        const url = yield* uploads.signedPreview(user.id, input.params.fileId);
        return { expiresAt: expiresIn("preview"), url };
      })
  );
