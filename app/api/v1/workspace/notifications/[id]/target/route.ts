import { respondWith } from "@/src/server/api/http-response";
import { openWorkspaceNotificationTarget } from "@/src/server/api/notifications/workspace";

export const GET = async (
  request: Request,
  context: { readonly params: Promise<Record<string, string>> }
): Promise<Response> =>
  respondWith(openWorkspaceNotificationTarget(request, await context.params));
