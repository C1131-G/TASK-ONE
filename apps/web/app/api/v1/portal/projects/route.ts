import { respondWith } from "@/src/server/api/http-response";
import { listPortalProjectPage } from "@/src/server/api/lists/projects";

export const GET = (request: Request): Promise<Response> =>
  respondWith(listPortalProjectPage(request));
