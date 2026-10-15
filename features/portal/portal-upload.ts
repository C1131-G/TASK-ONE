import { putWithProgress } from "@/features/files/upload-transport";
import {
  finalizePortalUploadAction,
  requestPortalUploadAction,
} from "@/features/portal/portal-actions";

export type PortalUploadResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

const failed = (name: string): PortalUploadResult => ({
  message: `Upload failed for ${name}. Try again.`,
  ok: false,
});

// Uploads one file to a bug the client already owns: ticket, signed PUT, then
// finalize (which also links the file to the bug).
export const uploadPortalFile = async (
  bugId: string,
  file: File,
  onProgress?: (loadedBytes: number) => void
): Promise<PortalUploadResult> => {
  try {
    const ticket = await requestPortalUploadAction({
      bugId,
      contentType: file.type || "application/octet-stream",
      fileName: file.name,
      sizeBytes: file.size,
    });
    if (!ticket.ok) {
      return { message: ticket.error.message, ok: false };
    }
    const put = await putWithProgress(
      ticket.data.uploadUrl,
      ticket.data.requiredHeaders,
      file,
      (loaded) => onProgress?.(loaded),
      new AbortController().signal
    );
    if (put !== "ok") {
      return failed(file.name);
    }
    const finalized = await finalizePortalUploadAction({
      bugId,
      idempotencyKey: crypto.randomUUID(),
      uploadIntentId: ticket.data.uploadIntentId,
    });
    return finalized.ok
      ? { ok: true }
      : { message: finalized.error.message, ok: false };
  } catch {
    return failed(file.name);
  }
};

export interface FailedFile {
  readonly file: File;
  readonly message: string;
}

// Uploads files one at a time to keep memory and bandwidth predictable, and
// returns the ones that failed.
export const uploadPortalFiles = async (
  bugId: string,
  files: readonly File[],
  onStart?: (index: number, file: File) => void
): Promise<FailedFile[]> => {
  const failures: FailedFile[] = [];
  for (const [index, file] of files.entries()) {
    onStart?.(index, file);
    // oxlint-disable-next-line no-await-in-loop, react-doctor/async-await-in-loop -- Sequential on purpose.
    const result = await uploadPortalFile(bugId, file);
    if (!result.ok) {
      failures.push({ file, message: result.message });
    }
  }
  return failures;
};
