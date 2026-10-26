import {
  listPortalBugs,
  submitPortalBug,
} from "@/src/server/api/bugs/portal-bugs";
import { respondWith } from "@/src/server/api/http-response";

// Reading the request headers keeps these answers per request.
export const GET = (request: Request): Promise<Response> =>
  respondWith(listPortalBugs(request));

export const POST = (request: Request): Promise<Response> =>
  respondWith(submitPortalBug(request));
