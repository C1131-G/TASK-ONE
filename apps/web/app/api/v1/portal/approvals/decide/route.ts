import { decidePortalApproval } from "@/src/server/api/bugs/portal-approvals";
import { respondWith } from "@/src/server/api/http-response";

export const POST = (request: Request): Promise<Response> =>
  respondWith(decidePortalApproval(request));
