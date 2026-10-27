import { downloadWorkspaceAttachment } from "@/src/server/api/attachments/staff-attachments";
import { respondWith } from "@/src/server/api/http-response";

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
): Promise<Response> =>
  respondWith(downloadWorkspaceAttachment(request, await params));
