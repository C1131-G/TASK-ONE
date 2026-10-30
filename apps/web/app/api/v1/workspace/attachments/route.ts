import { listWorkspaceAttachments } from "@/src/server/api/attachments/staff-attachments";
import { respondWith } from "@/src/server/api/http-response";

export const GET = (request: Request): Promise<Response> =>
  respondWith(listWorkspaceAttachments(request, {}));
