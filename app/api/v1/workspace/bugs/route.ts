import { listWorkspaceBugs } from "@/src/server/api/bugs/staff-bug-list";
import { respondWith } from "@/src/server/api/http-response";

// Reading the request headers keeps these answers per request.
export const GET = (request: Request): Promise<Response> =>
  respondWith(listWorkspaceBugs(request));
