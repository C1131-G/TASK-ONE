import { listPortalBugPage } from "@/src/server/api/bugs/portal-bugs";
import { respondWith } from "@/src/server/api/http-response";

// Reading the request keeps this answer per request.
export const GET = (request: Request): Promise<Response> =>
  respondWith(listPortalBugPage(request));
