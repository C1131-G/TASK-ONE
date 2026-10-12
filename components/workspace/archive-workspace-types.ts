interface ArchivedProject {
  readonly archivedAt: string | null;
  readonly id: string;
  readonly name: string;
  readonly version: number;
}

interface ArchivedTask {
  readonly archivedAt: string | null;
  readonly id: string;
  readonly projectName: string;
  readonly title: string;
  readonly version: number;
}

export type { ArchivedProject, ArchivedTask };
