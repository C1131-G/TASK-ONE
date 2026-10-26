import { finalizeWorkspaceUpload } from "@/src/server/api/attachments/staff-attachments";
import { respondWith } from "@/src/server/api/http-response";

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ uploadIntentId: string }> }
): Promise<Response> =>
  respondWith(finalizeWorkspaceUpload(request, await params));
