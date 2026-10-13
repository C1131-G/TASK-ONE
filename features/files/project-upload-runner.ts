import {
  finalizeUploadAction,
  requestProjectUploadAction,
  requestTaskUploadAction,
} from "@/features/files/files-actions";
import type { UploadRunner } from "@/features/files/hooks/use-upload-queue";

const uploadRunner =
  (projectId: string | null, taskId: string | null) =>
  (file: File): UploadRunner => {
    const input = {
      contentType: file.type || "application/octet-stream",
      fileName: file.name,
      sizeBytes: file.size,
    };
    let uploadIntentId = "";
    return {
      finalize: async () => {
        const result = await finalizeUploadAction({
          idempotencyKey: crypto.randomUUID(),
          uploadIntentId,
        });
        return result.ok ? null : result.error.message;
      },
      request: async () => {
        const ticket = taskId
          ? await requestTaskUploadAction({ ...input, taskId })
          : await requestProjectUploadAction({
              ...input,
              projectId: projectId ?? "",
            });
        if (!ticket.ok) {
          return { message: ticket.error.message, ok: false };
        }
        ({ uploadIntentId } = ticket.data);
        return {
          ok: true,
          ticket: {
            requiredHeaders: ticket.data.requiredHeaders,
            uploadUrl: ticket.data.uploadUrl,
          },
        };
      },
    };
  };

export { uploadRunner };
