import { decideBugApproval } from "@/src/server/api/bugs/staff-bugs";
import { respondWith } from "@/src/server/api/http-response";

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ bugId: string }> }
): Promise<Response> => respondWith(decideBugApproval(request, await params));
