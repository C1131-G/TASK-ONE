/* eslint-disable shadcn/no-unknown-classes */

"use client";

import { ListBullets, SquaresFour, UploadSimple } from "@phosphor-icons/react";
import { useRef } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";
import type {
  FileLayout,
  FileSort,
} from "@/features/files/types/project-file-types";

const FILE_SORTS: readonly FileSort[] = ["newest", "oldest", "name", "size"];

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
          onValueChange={(value) => {
            const selectedSort = FILE_SORTS.find(
              (sortOption) => sortOption === value
            );
            if (selectedSort) {
              onSortChange(selectedSort);
            }
          }}
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

export { ProjectFilesToolbar };
