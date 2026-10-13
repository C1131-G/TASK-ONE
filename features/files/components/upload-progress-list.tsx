/* eslint-disable shadcn/no-unknown-classes */

"use client";

import { Progress } from "@/components/ui/progress";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { uploadPercent } from "@/features/files/upload-store";
import type { UploadItem } from "@/features/files/upload-store";

const statusLabel = (item: UploadItem): string => {
  if (item.status === "done") {
    return "Uploaded";
  }
  if (item.status === "cancelled") {
    return "Cancelled";
  }
  if (item.status === "error") {
    return item.error ?? "Upload failed";
  }
  return `${uploadPercent(item)}%`;
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
  const finished = uploads.some((item) => item.status !== "uploading");
  return (
    <section aria-label="Uploads" className="panel-b stack upload-list">
      <ul className="stack">
        {uploads.map((item) => (
          <li className="stack" key={item.id}>
            <div className="row">
              <span className="trunc grow">{item.name}</span>
              <span
                className={item.status === "error" ? "error" : "muted"}
                role={item.status === "error" ? "alert" : undefined}
              >
                {statusLabel(item)}
              </span>
              {item.status === "uploading" ? (
                <WorkspaceButton
                  aria-label={`Cancel upload of ${item.name}`}
                  onClick={() => onCancel(item.id)}
                  size="sm"
                  type="button"
                  workspace
                >
                  Cancel
                </WorkspaceButton>
              ) : (
                <>
                  {item.status === "done" ? null : (
                    <WorkspaceButton
                      aria-label={`Retry upload of ${item.name}`}
                      onClick={() => onRetry(item.id)}
                      size="sm"
                      type="button"
                      workspace
                    >
                      Retry
                    </WorkspaceButton>
                  )}
                  <WorkspaceButton
                    aria-label={`Dismiss ${item.name}`}
                    onClick={() => onDismiss(item.id)}
                    size="sm"
                    type="button"
                    workspace
                  >
                    Dismiss
                  </WorkspaceButton>
                </>
              )}
            </div>
            {item.status === "uploading" ? (
              <Progress
                aria-label={`Uploading ${item.name}`}
                value={uploadPercent(item)}
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
