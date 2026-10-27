import { requestPortalUpload } from "@/src/server/api/attachments/portal-attachments";
import { respondWith } from "@/src/server/api/http-response";

export const POST = (request: Request): Promise<Response> =>
  respondWith(requestPortalUpload(request, {}));
