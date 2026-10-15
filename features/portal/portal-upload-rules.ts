// Mirrors the server's client upload limits so people get a friendly message
// before anything is sent. The server still enforces them.
export const PORTAL_ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "video/mp4",
] as const;

export const PORTAL_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const PORTAL_MAX_FILES_PER_BUG = 10;
export const PORTAL_FILE_ACCEPT = PORTAL_ALLOWED_TYPES.join(",");

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const fileProblem = (file: File): string | null => {
  if (!PORTAL_ALLOWED_TYPES.some((type) => type === file.type)) {
    return `${file.name} is not supported. Attach images, PDF files, or MP4 videos.`;
  }
  if (file.size > PORTAL_MAX_FILE_BYTES) {
    return `${file.name} is larger than 10 MB.`;
  }
  if (file.size === 0) {
    return `${file.name} is empty.`;
  }
  return null;
};

// Splits chosen files into the ones to keep and friendly messages for the rest.
export const acceptFiles = (
  current: readonly File[],
  incoming: readonly File[],
  slots: number
): { readonly files: File[]; readonly problems: string[] } => {
  const files = [...current];
  const problems: string[] = [];
  for (const file of incoming) {
    const problem = fileProblem(file);
    if (problem) {
      problems.push(problem);
    } else if (
      files.some(
        (existing) =>
          existing.name === file.name &&
          existing.size === file.size &&
          existing.lastModified === file.lastModified
      )
    ) {
      problems.push(`${file.name} is already added.`);
    } else if (files.length >= slots) {
      problems.push(
        `${file.name} was not added. A bug can have at most ${PORTAL_MAX_FILES_PER_BUG} attachments.`
      );
    } else {
      files.push(file);
    }
  }
  return { files, problems };
};
