import { listPortalAttachments } from "@/src/server/api/attachments/portal-attachments";
import { respondWith } from "@/src/server/api/http-response";

export const GET = (request: Request): Promise<Response> =>
  respondWith(listPortalAttachments(request, {}));
