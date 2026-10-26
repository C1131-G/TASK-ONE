import { confirmPortalBugFix } from "@/src/server/api/bugs/portal-bugs";
import { respondWith } from "@/src/server/api/http-response";

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ bugId: string }> }
): Promise<Response> => respondWith(confirmPortalBugFix(request, await params));
