import type { Store } from "@tanstack/store";
import { createStore } from "@tanstack/store";

export type UploadStatus = "uploading" | "done" | "error" | "cancelled";

export interface UploadItem {
  readonly id: string;
  readonly name: string;
  readonly sizeBytes: number;
  readonly loadedBytes: number;
  readonly status: UploadStatus;
  readonly error: string | null;
}

// Client UI state for in-flight uploads. The files themselves and their abort
// controllers stay in the queue hook; this holds only what the list renders.
export interface UploadState {
  readonly uploads: readonly UploadItem[];
}

type UploadStoreSetState = Store<UploadState>["setState"];

const patchItem = (
  state: UploadState,
  id: string,
  patch: Partial<UploadItem>
): UploadState => ({
  uploads: state.uploads.map((upload) =>
    upload.id === id ? { ...upload, ...patch } : upload
  ),
});

export const uploadActions = ({
  setState,
}: {
  readonly setState: UploadStoreSetState;
}) => ({
  add: (upload: Pick<UploadItem, "id" | "name" | "sizeBytes">) =>
    setState((previous) => ({
      uploads: [
        ...previous.uploads,
        { ...upload, error: null, loadedBytes: 0, status: "uploading" },
      ],
    })),
  cancelled: (id: string) =>
    setState((previous) => patchItem(previous, id, { status: "cancelled" })),
  clearFinished: () =>
    setState((previous) => ({
      uploads: previous.uploads.filter(
        (upload) => upload.status === "uploading"
      ),
    })),
  dismiss: (id: string) =>
    setState((previous) => ({
      uploads: previous.uploads.filter((upload) => upload.id !== id),
    })),
  done: (id: string) =>
    setState((previous) => {
      const finishedUpload = previous.uploads.find((entry) => entry.id === id);
      return patchItem(previous, id, {
        error: null,
        loadedBytes: finishedUpload?.sizeBytes ?? 0,
        status: "done",
      });
    }),
  failed: (id: string, error: string) =>
    setState((previous) => patchItem(previous, id, { error, status: "error" })),
  progress: (id: string, loadedBytes: number) =>
    setState((previous) => patchItem(previous, id, { loadedBytes })),
  restart: (id: string) =>
    setState((previous) =>
      patchItem(previous, id, {
        error: null,
        loadedBytes: 0,
        status: "uploading",
      })
    ),
});

export type UploadActions = ReturnType<typeof uploadActions>;

export const createUploadStore = () =>
  createStore<UploadState, UploadActions>({ uploads: [] }, uploadActions);

export type UploadStore = ReturnType<typeof createUploadStore>;

export const uploadPercent = (upload: UploadItem): number =>
  upload.sizeBytes <= 0
    ? 0
    : Math.min(100, Math.round((upload.loadedBytes / upload.sizeBytes) * 100));
