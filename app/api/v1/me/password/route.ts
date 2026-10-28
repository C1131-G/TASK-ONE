import { respondWith } from "@/src/server/api/http-response";
import { changePassword } from "@/src/server/api/me-password";

export const POST = (request: Request): Promise<Response> =>
  respondWith(changePassword(request));
