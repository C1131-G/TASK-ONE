import { Effect } from "effect";

import {
  AttachmentFileSchema,
  finalizeWorkspaceUploadRoute,
  requestWorkspaceUploadRoute,
} from "../../../mobile-api/routes-attachments";
import { Idempotency } from "../../core/idempotency";
import { Uploads } from "../../storage/uploads-contracts";
import { asStaffAttachmentCaller } from "./caller";
import type { PathParams } from "./caller";
import { summarizeFile } from "./file-summary";
import { withUploadExpiry } from "./signed-urls";

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
