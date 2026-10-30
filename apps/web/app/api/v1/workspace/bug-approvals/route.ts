import { listBugApprovals } from "@/src/server/api/bugs/staff-bug-approvals";
import { respondWith } from "@/src/server/api/http-response";

export const GET = (request: Request): Promise<Response> =>
  respondWith(listBugApprovals(request));
