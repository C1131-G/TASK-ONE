import { submitPortalBug } from "@/src/server/api/bugs/portal-bugs";
import { respondWith } from "@/src/server/api/http-response";

// Reading the request headers keeps this answer per request. The list of a
// company's bugs lives at /portal/bug-reports.
export const POST = (request: Request): Promise<Response> =>
  respondWith(submitPortalBug(request));
