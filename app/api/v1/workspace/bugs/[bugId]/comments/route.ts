import { addWorkspaceBugComment } from "@/src/server/api/bugs/staff-bug-comments";
import { respondWith } from "@/src/server/api/http-response";

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ bugId: string }> }
): Promise<Response> =>
  respondWith(addWorkspaceBugComment(request, await params));
