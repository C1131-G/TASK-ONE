import { previewPortalAttachment } from "@/src/server/api/attachments/portal-attachments";
import { respondWith } from "@/src/server/api/http-response";

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
): Promise<Response> =>
  respondWith(previewPortalAttachment(request, await params));
