/* eslint-disable shadcn/no-unknown-classes */

"use client";

import {
  DotsThreeVertical,
  ListBullets,
  SquaresFour,
  UploadSimple,
} from "@phosphor-icons/react";
import type { FormEvent } from "react";
import { useRef } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  FileLayout,
  FileSort,
  ProjectFile,
} from "@/components/workspace/project-file-types";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";

type FileAction = "download" | "preview" | "duplicate" | "remove";

const FILE_COPY_STATE_LABELS = {
  failed: "Copy failed",
  pending: "Copying",
  ready: "Ready",
} as const;

const formatBytes = (size: number) => {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileType = (file: ProjectFile) =>
  file.originalName.split(".").at(-1)?.toLocaleUpperCase() ?? "FILE";

const ProjectFilesToolbar = ({
  canUpload,
  fileTypes,
  layout,
  onFilesSelected,
  onLayoutChange,
  onQueryChange,
  onSortChange,
  onTypeChange,
  query,
  sort,
  typeFilter,
}: {
  readonly canUpload: boolean;
  readonly fileTypes: readonly string[];
  readonly layout: FileLayout;
  readonly onFilesSelected: (files: FileList | null) => void;
  readonly onLayoutChange: (layout: FileLayout) => void;
  readonly onQueryChange: (query: string) => void;
  readonly onSortChange: (sort: FileSort) => void;
  readonly onTypeChange: (type: string) => void;
  readonly query: string;
  readonly sort: FileSort;
  readonly typeFilter: string;
}) => {
  const uploadInput = useRef<HTMLInputElement>(null);

  return (
    <div className="panel-h file-toolbar">
      <div className="file-search">
        <WorkspaceInput
          aria-label="Search project files"
          autoComplete="off"
          className="w-full"
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          placeholder="Search files"
          type="search"
          value={query}
        />
      </div>
      <div className="file-filter">
        <WorkspaceSelect
          ariaLabel="Filter files by type"
          className="w-full"
          onValueChange={onTypeChange}
          value={typeFilter}
        >
          <WorkspaceSelectItem value="all">All types</WorkspaceSelectItem>
          {fileTypes.map((contentType) => (
            <WorkspaceSelectItem key={contentType} value={contentType}>
              {contentType}
            </WorkspaceSelectItem>
          ))}
        </WorkspaceSelect>
      </div>
      <div className="file-sort">
        <WorkspaceSelect
          ariaLabel="Sort files"
          className="w-full"
          onValueChange={(value) => onSortChange(value as FileSort)}
          value={sort}
        >
          <WorkspaceSelectItem value="newest">Sort: Newest</WorkspaceSelectItem>
          <WorkspaceSelectItem value="oldest">Sort: Oldest</WorkspaceSelectItem>
          <WorkspaceSelectItem value="name">Sort: Name</WorkspaceSelectItem>
          <WorkspaceSelectItem value="size">Sort: Largest</WorkspaceSelectItem>
        </WorkspaceSelect>
      </div>
      <fieldset aria-label="File layout" className="file-layout-switch">
        <legend className="sr-only">File layout</legend>
        <WorkspaceButton
          active={layout === "grid"}
          aria-label="Grid view"
          aria-pressed={layout === "grid"}
          data-file-layout-button="grid"
          onClick={() => onLayoutChange("grid")}
          size="icon-sm"
          type="button"
          workspace
        >
          <SquaresFour aria-hidden="true" size={16} />
        </WorkspaceButton>
        <WorkspaceButton
          active={layout === "list"}
          aria-label="List view"
          aria-pressed={layout === "list"}
          data-file-layout-button="list"
          onClick={() => onLayoutChange("list")}
          size="icon-sm"
          type="button"
          workspace
        >
          <ListBullets aria-hidden="true" size={16} />
        </WorkspaceButton>
      </fieldset>
      {canUpload ? (
        <>
          <WorkspaceButton
            onClick={() => uploadInput.current?.click()}
            size="sm"
            type="button"
            variant="default"
            workspace
          >
            <UploadSimple aria-hidden="true" size={16} />
            Upload
          </WorkspaceButton>
          <WorkspaceInput
            accept="*/*"
            aria-label="Choose files to upload"
            className="sr-only"
            multiple
            onChange={(event) => {
              onFilesSelected(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
            ref={uploadInput}
            type="file"
          />
        </>
      ) : null}
    </div>
  );
};

const ProjectFileCard = ({
  canManage,
  currentUserId,
  file,
  isAdmin,
  onAction,
  onRename,
  pending,
}: {
  readonly canManage: boolean;
  readonly currentUserId: string | null;
  readonly file: ProjectFile;
  readonly isAdmin: boolean;
  readonly onAction: (fileId: string, action: FileAction) => void;
  readonly onRename: (file: ProjectFile) => void;
  readonly pending: boolean;
}) => (
  <article className="file-card" key={file.id}>
    <div aria-hidden="true" className="file-card-preview">
      <span>{getFileType(file)}</span>
    </div>
    <div className="file-card-main">
      <strong className="file-card-name" title={file.originalName}>
        {file.originalName}
      </strong>
      <span className="file-card-details">
        {formatBytes(file.sizeBytes)} · {file.createdAt.slice(0, 10)}
      </span>
      <span className={`file-copy-state ${file.copyState}`}>
        {FILE_COPY_STATE_LABELS[file.copyState]}
      </span>
    </div>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <WorkspaceButton
          aria-label={`Options for ${file.originalName}`}
          disabled={pending}
          size="icon-sm"
          type="button"
          workspace
        >
          <DotsThreeVertical aria-hidden="true" size={17} />
        </WorkspaceButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" data-workspace-menu="">
        <DropdownMenuItem onSelect={() => onAction(file.id, "preview")}>
          Preview
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction(file.id, "download")}>
          Download
        </DropdownMenuItem>
        {canManage ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onRename(file)}>
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAction(file.id, "duplicate")}>
              Duplicate
            </DropdownMenuItem>
          </>
        ) : null}
        {isAdmin || file.uploadedById === currentUserId ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => onAction(file.id, "remove")}
              variant="destructive"
            >
              Remove
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  </article>
);

const ProjectFileRenameDialog = ({
  error,
  onNameChange,
  onOpenChange,
  onSubmit,
  open,
  pending,
  value,
}: {
  readonly error: string | null;
  readonly onNameChange: (value: string) => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly open: boolean;
  readonly pending: boolean;
  readonly value: string;
}) => (
  <Dialog onOpenChange={onOpenChange} open={open}>
    <DialogContent workspace>
      <DialogHeader>
        <DialogTitle>Rename file</DialogTitle>
        <DialogDescription>
          Choose a new name for this project file.
        </DialogDescription>
      </DialogHeader>
      <form className="stack" onSubmit={onSubmit}>
        <label className="field" htmlFor="project-file-new-name">
          File name
          <WorkspaceInput
            autoFocus
            id="project-file-new-name"
            maxLength={255}
            onChange={(event) => onNameChange(event.currentTarget.value)}
            required
            value={value}
          />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <div className="file-rename-actions">
          <WorkspaceButton
            onClick={() => onOpenChange(false)}
            size="sm"
            type="button"
            variant="secondary"
            workspace
          >
            Cancel
          </WorkspaceButton>
          <WorkspaceButton
            disabled={pending || !value.trim()}
            size="sm"
            type="submit"
            variant="default"
            workspace
          >
            {pending ? "Saving…" : "Save name"}
          </WorkspaceButton>
        </div>
      </form>
    </DialogContent>
  </Dialog>
);

export { ProjectFileCard, ProjectFilesToolbar, ProjectFileRenameDialog };
