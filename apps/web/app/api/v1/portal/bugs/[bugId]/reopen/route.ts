import { reopenPortalBugFix } from "@/src/server/api/bugs/portal-bugs";
import { respondWith } from "@/src/server/api/http-response";

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ bugId: string }> }
): Promise<Response> => respondWith(reopenPortalBugFix(request, await params));
