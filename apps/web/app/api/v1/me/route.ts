import { respondWith } from "@/src/server/api/http-response";
import { getMe } from "@/src/server/api/me";

// Reading the request keeps this answer per request.
export const GET = (request: Request): Promise<Response> =>
  respondWith(getMe(request));
