import { Effect } from "effect";

import { requestWorkspaceUploadRoute } from "../../../mobile-api/routes-attachments";
import { Uploads } from "../../storage/uploads-contracts";
import { asStaffAttachmentCaller } from "./caller";
import type { PathParams } from "./caller";
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
