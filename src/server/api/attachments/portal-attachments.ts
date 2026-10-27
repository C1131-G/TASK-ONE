import { Effect } from "effect";

import {
  downloadPortalAttachmentRoute,
  finalizePortalUploadRoute,
  listPortalAttachmentsRoute,
  PortalAttachmentSchema,
  previewPortalAttachmentRoute,
  requestPortalUploadRoute,
} from "../../../mobile-api/routes-attachments";
import { Idempotency } from "../../core/idempotency";
import { PortalBugs } from "../../portal/portal-contracts";
import { Uploads } from "../../storage/uploads-contracts";
import { asPortalAttachmentCaller } from "./caller";
import type { PathParams } from "./caller";
import { summarizeFile } from "./file-summary";
import type { AttachmentSummary } from "./file-summary";
import { expiresIn, withUploadExpiry } from "./signed-urls";

// The attachment as the web portal shows it on a bug: a name for the person
// who uploaded it, never an account id.
const toPortalAttachment = (file: AttachmentSummary) => ({
  contentType: file.contentType,
  createdAt: file.createdAt,
  fileId: file.id,
  fileName: file.name,
  previewable: file.previewable,
  sizeBytes: file.sizeBytes,
  uploaderName: file.uploadedBy.name,
});

// A client uploads to the task behind one of its own open bugs. The web does
// the same after the bug exists, so the report itself stays a plain write.
export const requestPortalUpload = (request: Request, params: PathParams) =>
  asPortalAttachmentCaller(
    requestPortalUploadRoute,
    request,
    params,
    ({ actor, input, user }) =>
      Effect.gen(function* requestUpload() {
        const bugs = yield* PortalBugs;
        const uploads = yield* Uploads;
        const { bugId, ...file } = input.body;
        const taskId = yield* bugs.taskIdForBug(actor, bugId);
        const ticket = yield* uploads.requestTaskUpload(user.id, {
          ...file,
          taskId,
        });
        return withUploadExpiry(ticket);
      })
  );

// Finalizing and linking the file to the bug are one write, as on the web, so
// a retry never leaves a file that no bug shows.
export const finalizePortalUpload = (request: Request, params: PathParams) =>
  asPortalAttachmentCaller(
    finalizePortalUploadRoute,
    request,
    params,
    ({ actor, input, user }) =>
      Effect.gen(function* finalize() {
        const bugs = yield* PortalBugs;
        const uploads = yield* Uploads;
        const idempotency = yield* Idempotency;
        const { uploadIntentId } = input.params;
        const { bugId } = input.body;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () =>
            Effect.gen(function* finalizeAndAttach() {
              const file = yield* uploads.finalizeUpload(
                user.id,
                uploadIntentId
              );
              yield* bugs.attachFile(actor, { bugId, fileId: file.id });
              return toPortalAttachment(yield* summarizeFile(file.id));
            }),
          input: { bugId, uploadIntentId },
          key: input.idempotencyKey,
          operation: "mobile.portal.attachment.finalize",
          resultSchema: PortalAttachmentSchema,
        });
      })
  );

// The bug's own detail decides what a client may see: only files that
// client-company users attached. Staff evidence never appears.
export const listPortalAttachments = (request: Request, params: PathParams) =>
  asPortalAttachmentCaller(
    listPortalAttachmentsRoute,
    request,
    params,
    ({ actor, input }) =>
      Effect.gen(function* list() {
        const bugs = yield* PortalBugs;
        const bug = yield* bugs.getBug(actor, input.query.bugId);
        return { items: bug.attachments };
      })
  );

export const downloadPortalAttachment = (
  request: Request,
  params: PathParams
) =>
  asPortalAttachmentCaller(
    downloadPortalAttachmentRoute,
    request,
    params,
    ({ input, user }) =>
      Effect.gen(function* download() {
        const uploads = yield* Uploads;
        const url = yield* uploads.signedDownload(user.id, input.params.fileId);
        return { expiresAt: expiresIn("download"), url };
      })
  );

export const previewPortalAttachment = (request: Request, params: PathParams) =>
  asPortalAttachmentCaller(
    previewPortalAttachmentRoute,
    request,
    params,
    ({ input, user }) =>
      Effect.gen(function* preview() {
        const uploads = yield* Uploads;
        const url = yield* uploads.signedPreview(user.id, input.params.fileId);
        return { expiresAt: expiresIn("preview"), url };
      })
  );
