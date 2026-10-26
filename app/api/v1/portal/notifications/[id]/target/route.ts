import { respondWith } from "@/src/server/api/http-response";
import { openPortalNotificationTarget } from "@/src/server/api/notifications/portal";

export const GET = async (
  request: Request,
  context: { readonly params: Promise<Record<string, string>> }
): Promise<Response> =>
  respondWith(openPortalNotificationTarget(request, await context.params));
