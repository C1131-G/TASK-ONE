/* eslint-disable shadcn/no-unknown-classes */

"use client";

import { Progress } from "@/components/ui/progress";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { uploadPercent } from "@/features/files/upload-store";
import type { UploadItem } from "@/features/files/upload-store";

const statusLabel = (upload: UploadItem): string => {
  if (upload.status === "done") {
    return "Uploaded";
  }
  if (upload.status === "cancelled") {
    return "Cancelled";
  }
  if (upload.status === "error") {
    return upload.error ?? "Upload failed";
  }
  return `${uploadPercent(upload)}%`;
};

export const UploadProgressList = ({
  onCancel,
  onClearFinished,
  onDismiss,
  onRetry,
  uploads,
}: {
  readonly onCancel: (id: string) => void;
  readonly onClearFinished: () => void;
  readonly onDismiss: (id: string) => void;
  readonly onRetry: (id: string) => void;
  readonly uploads: readonly UploadItem[];
}) => {
  if (uploads.length === 0) {
    return null;
  }
  const finished = uploads.some((upload) => upload.status !== "uploading");
  return (
    <section aria-label="Uploads" className="panel-b stack upload-list">
      <ul className="stack">
        {uploads.map((upload) => (
          <li className="stack" key={upload.id}>
            <div className="row">
              <span className="trunc grow">{upload.name}</span>
              <span
                className={upload.status === "error" ? "error" : "muted"}
                role={upload.status === "error" ? "alert" : undefined}
              >
                {statusLabel(upload)}
              </span>
              {upload.status === "uploading" ? (
                <WorkspaceButton
                  aria-label={`Cancel upload of ${upload.name}`}
                  onClick={() => onCancel(upload.id)}
                  size="sm"
                  type="button"
                  workspace
                >
                  Cancel
                </WorkspaceButton>
              ) : (
                <>
                  {upload.status === "done" ? null : (
                    <WorkspaceButton
                      aria-label={`Retry upload of ${upload.name}`}
                      onClick={() => onRetry(upload.id)}
                      size="sm"
                      type="button"
                      workspace
                    >
                      Retry
                    </WorkspaceButton>
                  )}
                  <WorkspaceButton
                    aria-label={`Dismiss ${upload.name}`}
                    onClick={() => onDismiss(upload.id)}
                    size="sm"
                    type="button"
                    workspace
                  >
                    Dismiss
                  </WorkspaceButton>
                </>
              )}
            </div>
            {upload.status === "uploading" ? (
              <Progress
                aria-label={`Uploading ${upload.name}`}
                value={uploadPercent(upload)}
              />
            ) : null}
          </li>
        ))}
      </ul>
      {finished ? (
        <WorkspaceButton
          onClick={onClearFinished}
          size="sm"
          type="button"
          workspace
        >
          Clear finished
        </WorkspaceButton>
      ) : null}
    </section>
  );
};
