interface ProjectFile {
  readonly id: string;
  readonly projectId: string;
  readonly taskId: string | null;
  readonly originalName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly uploadedById: string;
  readonly createdAt: string;
  readonly copyState: "pending" | "ready" | "failed";
}

type FileLayout = "grid" | "list";
type FileSort = "newest" | "oldest" | "name" | "size";

export type { FileLayout, FileSort, ProjectFile };
