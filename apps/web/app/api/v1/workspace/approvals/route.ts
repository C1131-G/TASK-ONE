import { requestWorkspaceApproval } from "@/src/server/api/bugs/staff-approval-requests";
import { respondWith } from "@/src/server/api/http-response";

export const POST = (request: Request): Promise<Response> =>
  respondWith(requestWorkspaceApproval(request));
