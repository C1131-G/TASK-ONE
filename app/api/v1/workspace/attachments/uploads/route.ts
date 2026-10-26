import { requestWorkspaceUpload } from "@/src/server/api/attachments/staff-attachments";
import { respondWith } from "@/src/server/api/http-response";

export const POST = (request: Request): Promise<Response> =>
  respondWith(requestWorkspaceUpload(request, {}));
