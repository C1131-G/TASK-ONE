import { getPortalApproval } from "@/src/server/api/bugs/portal-approvals";
import { respondWith } from "@/src/server/api/http-response";

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
): Promise<Response> => respondWith(getPortalApproval(request, await params));
