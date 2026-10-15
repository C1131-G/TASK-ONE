/* eslint-disable shadcn/no-unknown-classes */

"use client";

import { UploadSimple } from "@phosphor-icons/react";
import { useState } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import {
  ProjectFileCard,
  ProjectFileRenameDialog,
  ProjectFilesToolbar,
} from "@/features/files/components/project-file-parts";
import { UploadProgressList } from "@/features/files/components/upload-progress-list";
import { filterProjectFiles } from "@/features/files/filter-project-files";
import { useProjectFiles } from "@/features/files/hooks/use-project-files";
import type {
  FileLayout,
  FileSort,
  ProjectFile,
} from "@/features/files/types/project-file-types";
import type { TaskFile } from "@/features/tasks/task-details-panel-data";

const ProjectFiles = ({
  projectId,
  taskId,
  initialFiles,
  controlledFiles,
  setControlledFiles,
  canUpload,
  currentUserId,
  isAdmin,
}: {
  readonly projectId: string;
  readonly taskId?: string;
  readonly initialFiles: readonly ProjectFile[];
  readonly controlledFiles?: readonly TaskFile[];
  readonly setControlledFiles?: (files: readonly TaskFile[]) => void;
  readonly canUpload: boolean;
  readonly currentUserId: string | null;
  readonly isAdmin: boolean;
}) => {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sort, setSort] = useState<FileSort>("newest");
  const [layout, setLayout] = useState<FileLayout>("grid");
  const {
    actOnFile,
    error,
    files,
    openRename,
    pending,
    queue,
    renameValue,
    renamingFile,
    saveRename,
    setError,
    setRenameValue,
    setRenamingFile,
    undo,
    undoRemoval,
    upload,
  } = useProjectFiles({
    initialFiles,
    projectId,
    taskId,
    ...(controlledFiles ? { controlledFiles } : {}),
    ...(setControlledFiles ? { setControlledFiles } : {}),
  });

  const { fileTypes, filteredFiles } = filterProjectFiles(
    files,
    query,
    typeFilter,
    sort
  );

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
