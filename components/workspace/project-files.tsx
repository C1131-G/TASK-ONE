/* eslint-disable shadcn/no-unknown-classes */

"use client";

import { UploadSimple } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { FormEvent } from "react";

import {
  duplicateFileAction,
  finalizeUploadAction,
  getFileDownloadUrlAction,
  getFilePreviewUrlAction,
  listProjectFilesAction,
  listTaskFilesAction,
  removeFileAction,
  renameFileAction,
  requestProjectUploadAction,
  requestTaskUploadAction,
  undoFileRemovalAction,
} from "@/app/actions/uploads";
import {
  ProjectFileCard,
  ProjectFileRenameDialog,
  ProjectFilesToolbar,
} from "@/components/workspace/project-file-parts";
import type {
  FileLayout,
  FileSort,
  ProjectFile,
} from "@/components/workspace/project-file-types";
import { UploadProgressList } from "@/components/workspace/upload-progress-list";
import { useUploadQueue } from "@/components/workspace/use-upload-queue";
import type { UploadRunner } from "@/components/workspace/use-upload-queue";
import { WorkspaceButton } from "@/components/workspace/workspace-button";

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

const ProjectFiles = ({
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
  const [typeFilter, setTypeFilter] = useState("all");
  const [sort, setSort] = useState<FileSort>("newest");
  const [layout, setLayout] = useState<FileLayout>("grid");
  const [error, setError] = useState<string | null>(null);
  const [undo, setUndo] = useState<string | null>(null);
  const [renamingFile, setRenamingFile] = useState<ProjectFile | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const reloadFiles = async () => {
    const result = taskId
      ? await listTaskFilesAction({ taskId })
      : await listProjectFilesAction({ projectId });
    if (result.ok) {
      setFiles(result.data);
    }
  };

  // Each file settles on its own, so the list refreshes as uploads finish.
  const queue = useUploadQueue(async () => {
    await reloadFiles();
    router.refresh();
  });

  const upload = (selectedFiles: FileList | null) => {
    if (!selectedFiles?.length) {
      return;
    }
    setError(null);
    for (const file of selectedFiles) {
      queue.start(file, uploadRunner(projectId, taskId ?? null));
    }
  };

  const actOnFile = (
    fileId: string,
    action: "download" | "preview" | "duplicate" | "remove"
  ) =>
    startTransition(async () => {
      setError(null);
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

  const openRename = (file: ProjectFile) => {
    setError(null);
    setRenamingFile(file);
    setRenameValue(file.originalName);
  };

  const saveRename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!renamingFile) {
      return;
    }
    const currentFile = renamingFile;
    const newName = renameValue.trim();
    if (!newName || newName === currentFile.originalName) {
      setRenamingFile(null);
      return;
    }
    startTransition(async () => {
      setError(null);
      const result = await renameFileAction({
        fileId: currentFile.id,
        fileName: newName,
        idempotencyKey: crypto.randomUUID(),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setFiles((current) =>
        current.map((file) => (file.id === currentFile.id ? result.data : file))
      );
      setRenamingFile(null);
    });
  };

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

  const fileTypes = [
    ...new Set(files.map(({ contentType }) => contentType)),
  ].toSorted((left, right) => left.localeCompare(right));
  const filteredFiles = files
    .filter((file) => {
      const matchesQuery = `${file.originalName} ${file.contentType}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase());
      const matchesType =
        typeFilter === "all" || file.contentType === typeFilter;
      return matchesQuery && matchesType;
    })
    .toSorted((left, right) => {
      if (sort === "name") {
        return left.originalName.localeCompare(right.originalName);
      }
      if (sort === "size") {
        return right.sizeBytes - left.sizeBytes;
      }
      const dateOrder = left.createdAt.localeCompare(right.createdAt);
      return sort === "newest" ? -dateOrder : dateOrder;
    });

  return (
    <section aria-busy={pending} className="panel project-files">
      <ProjectFilesToolbar
        canUpload={canUpload}
        fileTypes={fileTypes}
        layout={layout}
        onFilesSelected={upload}
        onLayoutChange={setLayout}
        onQueryChange={setQuery}
        onSortChange={setSort}
        onTypeChange={setTypeFilter}
        query={query}
        sort={sort}
        typeFilter={typeFilter}
      />
      {canUpload ? (
        <div
          aria-label="Drop files to upload. Maximum size is 50 MB per file."
          className="file-dropzone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            upload(event.dataTransfer.files);
          }}
        >
          <UploadSimple aria-hidden="true" size={18} />
          <span>Drop files here or use Upload — up to 50 MB each</span>
        </div>
      ) : null}
      <UploadProgressList
        onCancel={queue.handleCancel}
        onClearFinished={queue.handleClearFinished}
        onDismiss={queue.handleDismiss}
        onRetry={queue.handleRetry}
        uploads={queue.uploads}
      />
      {error && !renamingFile ? (
        <p className="panel-b error" role="alert">
          {error}
        </p>
      ) : null}
      {undo ? (
        <div className="panel-b row file-undo-banner">
          <span>File removed.</span>
          <WorkspaceButton
            disabled={pending}
            onClick={undoRemoval}
            size="sm"
            type="button"
            workspace
          >
            Undo
          </WorkspaceButton>
        </div>
      ) : null}
      {filteredFiles.length ? (
        <div data-layout={layout} className="file-results">
          {filteredFiles.map((file) => (
            <ProjectFileCard
              canManage={canUpload}
              currentUserId={currentUserId}
              file={file}
              isAdmin={isAdmin}
              key={file.id}
              onAction={actOnFile}
              onRename={openRename}
              pending={pending}
            />
          ))}
        </div>
      ) : (
        <div className="panel-b file-empty-state">
          <h3>
            {query || typeFilter !== "all"
              ? "No files match these filters"
              : "No files yet"}
          </h3>
          <p className="muted">
            {query || typeFilter !== "all"
              ? "Change the search or file type to see more results."
              : "Files shared with this project will appear here."}
          </p>
        </div>
      )}
      <ProjectFileRenameDialog
        error={renamingFile ? error : null}
        onNameChange={setRenameValue}
        onOpenChange={(open) => {
          setRenamingFile(open ? renamingFile : null);
          if (open) {
            setError(null);
          }
        }}
        onSubmit={saveRename}
        open={renamingFile !== null}
        pending={pending}
        value={renameValue}
      />
    </section>
  );
};

export { ProjectFiles };
