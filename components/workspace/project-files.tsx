/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

/* eslint-disable jsx-a11y/label-has-associated-control */

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  duplicateFileAction,
  finalizeUploadAction,
  getFileDownloadUrlAction,
  getFilePreviewUrlAction,
  removeFileAction,
  renameFileAction,
  requestProjectUploadAction,
  requestTaskUploadAction,
  listProjectFilesAction,
  listTaskFilesAction,
  undoFileRemovalAction,
} from "@/app/actions/uploads";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";

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

const formatBytes = (size: number) => {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const uploadOne = async (
  projectId: string | null,
  taskId: string | null,
  file: File
): Promise<string | null> => {
  const input = {
    contentType: file.type || "application/octet-stream",
    fileName: file.name,
    sizeBytes: file.size,
  };
  const ticket = taskId
    ? await requestTaskUploadAction({ ...input, taskId })
    : await requestProjectUploadAction({
        ...input,
        projectId: projectId ?? "",
      });
  if (!ticket.ok) {
    return ticket.error.message;
  }
  const response = await fetch(ticket.data.uploadUrl, {
    body: file,
    headers: ticket.data.requiredHeaders,
    method: "PUT",
  });
  if (!response.ok) {
    return `Upload failed for ${file.name}. Check the storage configuration and try again.`;
  }
  const result = await finalizeUploadAction({
    idempotencyKey: crypto.randomUUID(),
    uploadIntentId: ticket.data.uploadIntentId,
  });
  return result.ok ? null : result.error.message;
};

export const ProjectFiles = ({
  projectId,
  taskId,
  initialFiles,
  canUpload,
  currentUserId,
  isAdmin,
}: {
  readonly projectId: string;
  readonly taskId?: string;
  readonly initialFiles: readonly ProjectFile[];
  readonly canUpload: boolean;
  readonly currentUserId: string | null;
  readonly isAdmin: boolean;
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [files, setFiles] = useState(initialFiles);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [undo, setUndo] = useState<string | null>(null);

  const reloadFiles = async () => {
    const result = taskId
      ? await listTaskFilesAction({ taskId })
      : await listProjectFilesAction({ projectId });
    if (result.ok) {
      setFiles(result.data);
    }
  };

  const upload = (selectedFiles: FileList | null) => {
    if (!selectedFiles?.length) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const errors = await Promise.all(
          [...selectedFiles].map((file) =>
            uploadOne(projectId, taskId ?? null, file)
          )
        );
        const firstError = errors.find((item): item is string => item !== null);
        if (firstError) {
          setError(firstError);
          return;
        }
        await reloadFiles();
        router.refresh();
      } catch {
        setError(
          "Upload failed. Check the storage configuration and try again."
        );
      }
    });
  };

  const actOnFile = (
    fileId: string,
    action: "download" | "preview" | "duplicate" | "remove"
  ) => {
    setError(null);
    startTransition(async () => {
      if (action === "download" || action === "preview") {
        const result =
          action === "download"
            ? await getFileDownloadUrlAction({ fileId })
            : await getFilePreviewUrlAction({ fileId });
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        window.location.assign(result.data);
        return;
      }
      if (action === "duplicate") {
        const result = await duplicateFileAction({
          fileId,
          idempotencyKey: crypto.randomUUID(),
        });
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        await reloadFiles();
        router.refresh();
        return;
      }
      const result = await removeFileAction({
        fileId,
        idempotencyKey: crypto.randomUUID(),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setUndo(result.data.undoId);
      setFiles((current) => current.filter((file) => file.id !== fileId));
    });
  };

  const rename = (file: ProjectFile, name: string) =>
    startTransition(async () => {
      const result = await renameFileAction({
        fileId: file.id,
        fileName: name.trim(),
        idempotencyKey: crypto.randomUUID(),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setFiles((current) =>
        current.map((item) => (item.id === file.id ? result.data : item))
      );
    });

  const undoRemoval = () => {
    if (!undo) {
      return;
    }
    startTransition(async () => {
      const result = await undoFileRemovalAction({
        idempotencyKey: crypto.randomUUID(),
        undoId: undo,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setUndo(null);
      await reloadFiles();
      router.refresh();
    });
  };

  const filteredFiles = files.filter((file) =>
    file.originalName.toLocaleLowerCase().includes(query.toLocaleLowerCase())
  );

  return (
    <section aria-busy={pending} className="panel project-files">
      <div className="panel-h row">
        <label className="inwrap">
          <span className="sr-only">Search files</span>
          <WorkspaceInput
            aria-label="Search project files"
            className="input search-sm"
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search files"
            value={query}
          />
        </label>
        <span className="sp" />
        {canUpload ? (
          <label className="btn btn-primary btn-sm">
            Upload files
            <WorkspaceInput
              accept="*/*"
              className="sr-only"
              multiple
              onChange={(event) => {
                upload(event.currentTarget.files);
                event.currentTarget.value = "";
              }}
              type="file"
            />
          </label>
        ) : null}
      </div>
      {error ? (
        <p className="panel-b error" role="alert">
          {error}
        </p>
      ) : null}
      {undo ? (
        <div className="panel-b row">
          <span>File removed.</span>
          <WorkspaceButton
            className="btn btn-sm btn-ghost"
            disabled={pending}
            onClick={undoRemoval}
            type="button"
          >
            Undo
          </WorkspaceButton>
        </div>
      ) : null}
      {filteredFiles.length ? (
        <div className="list-wrap">
          {filteredFiles.map((file) => (
            <article className="mini file-row" key={file.id}>
              <span aria-hidden="true" className="ftype">
                {file.contentType.split("/")[1]?.toUpperCase() ?? "FILE"}
              </span>
              <div className="grow">
                <label className="field">
                  <span className="sr-only">File name</span>
                  <WorkspaceInput
                    aria-label={`Rename ${file.originalName}`}
                    className="input"
                    defaultValue={file.originalName}
                    disabled={pending || !canUpload}
                    maxLength={255}
                    onBlur={(event) => {
                      if (
                        event.currentTarget.value.trim() !== file.originalName
                      ) {
                        rename(file, event.currentTarget.value);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.currentTarget.blur();
                      }
                    }}
                  />
                </label>
                <span className="fm">
                  {formatBytes(file.sizeBytes)} · {file.createdAt.slice(0, 10)}
                </span>
              </div>
              <span className="muted">{file.copyState}</span>
              <WorkspaceButton
                className="ibtn ibtn-sm"
                disabled={pending}
                onClick={() => actOnFile(file.id, "preview")}
                type="button"
              >
                Preview
              </WorkspaceButton>
              <WorkspaceButton
                className="ibtn ibtn-sm"
                disabled={pending}
                onClick={() => actOnFile(file.id, "download")}
                type="button"
              >
                Download
              </WorkspaceButton>
              {canUpload ? (
                <WorkspaceButton
                  className="ibtn ibtn-sm"
                  disabled={pending}
                  onClick={() => actOnFile(file.id, "duplicate")}
                  type="button"
                >
                  Duplicate
                </WorkspaceButton>
              ) : null}
              {isAdmin || file.uploadedById === currentUserId ? (
                <WorkspaceButton
                  className="ibtn ibtn-sm"
                  disabled={pending}
                  onClick={() => actOnFile(file.id, "remove")}
                  type="button"
                >
                  Remove
                </WorkspaceButton>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="panel-b muted">
          {query
            ? "No files match your search."
            : "No files have been added to this project."}
        </div>
      )}
    </section>
  );
};
