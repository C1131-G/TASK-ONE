"use client";

/* eslint-disable shadcn/no-restyle -- Preserve established portal classes on shared controls. */

/* eslint-disable shadcn/no-unknown-classes -- Portal classes are authored in apps/web/app/workspace-styles/portal.css. */

import { DownloadSimple, Eye } from "@phosphor-icons/react";
import { useState } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { getPortalFileUrlAction } from "@/features/portal/portal-upload-actions";
import { formatFileSize } from "@/features/portal/portal-upload-rules";
import type { PortalApprovalDetail } from "@/src/server/approvals/approval-contracts";

type ApprovalFile = PortalApprovalDetail["files"][number];

// Files open through the same signed, short-lived links the bug attachments
// use; the server re-checks each one belongs to this company's request.
const FileActions = ({ file }: { readonly file: ApprovalFile }) => {
  const [busy, setBusy] = useState<"download" | "preview" | null>(null);
  const [error, setError] = useState("");
  const open = async (disposition: "download" | "preview") => {
    setBusy(disposition);
    setError("");
    try {
      const result = await getPortalFileUrlAction({
        disposition,
        fileId: file.fileId,
      });
      if (!result.ok) {
        setError(result.error.message);
      } else if (disposition === "preview") {
        window.open(result.data, "_blank", "noopener,noreferrer");
      } else {
        window.location.assign(result.data);
      }
    } catch {
      setError("The file could not be opened. Try again.");
    }
    setBusy(null);
  };
  return (
    <>
      {file.previewable ? (
        <WorkspaceButton
          className="btn btn-secondary btn-sm"
          disabled={busy !== null}
          onClick={() => open("preview")}
          type="button"
        >
          <Eye aria-hidden="true" size={14} />
          {busy === "preview" ? "Opening…" : "Preview"}
        </WorkspaceButton>
      ) : null}
      <WorkspaceButton
        className="btn btn-secondary btn-sm"
        disabled={busy !== null}
        onClick={() => open("download")}
        type="button"
      >
        <DownloadSimple aria-hidden="true" size={14} />
        {busy === "download" ? "Preparing…" : "Download"}
      </WorkspaceButton>
      {error ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
};

export const PortalApprovalFiles = ({
  files,
}: {
  readonly files: PortalApprovalDetail["files"];
}) => (
  <ul aria-label="Files to review" className="portal-attachments">
    {files.map((file) => (
      <li className="portal-attachment" key={file.fileId}>
        <span className="portal-file-name">
          <strong>{file.fileName}</strong>
          <span className="faint">{formatFileSize(file.sizeBytes)}</span>
        </span>
        <FileActions file={file} />
      </li>
    ))}
  </ul>
);
