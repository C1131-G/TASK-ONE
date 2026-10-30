import { listPortalApprovals } from "@/src/server/api/bugs/portal-approvals";
import { respondWith } from "@/src/server/api/http-response";

export const GET = (request: Request): Promise<Response> =>
  respondWith(listPortalApprovals(request));
