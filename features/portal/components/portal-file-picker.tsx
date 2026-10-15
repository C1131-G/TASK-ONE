"use client";

/* eslint-disable shadcn/no-unknown-classes -- Portal classes are authored in app/workspace-styles/portal.css. */

import { FilePdf, FileVideo, UploadSimple, X } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState } from "react";
import type { DragEvent } from "react";

import {
  PORTAL_FILE_ACCEPT,
  acceptFiles,
  formatFileSize,
} from "@/features/portal/portal-upload-rules";

const FilePreview = ({ file }: { readonly file: File }) => {
  const [url, setUrl] = useState<string>();
  const isImage = file.type.startsWith("image/");
  useEffect(() => {
    if (!isImage) {
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    // An object URL is a browser resource, so it is created and released here.
    // oxlint-disable-next-line react/set-state-in-effect
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file, isImage]);

  if (isImage && url) {
    return (
      // oxlint-disable-next-line next/no-img-element, react-doctor/nextjs-no-img-element -- A local blob preview cannot go through the image optimizer.
      <img alt="" className="portal-thumb" height={64} src={url} width={64} />
    );
  }
  return (
    <span aria-hidden="true" className="portal-thumb portal-thumb-icon">
      {file.type === "video/mp4" ? (
        <FileVideo size={24} />
      ) : (
        <FilePdf size={24} />
      )}
    </span>
  );
};

// Screenshots and other evidence: drag and drop or pick. Files stay in the
// browser until the caller uploads them.
const PortalFilePicker = ({
  disabled = false,
  files,
  onChange,
  slots,
}: {
  readonly disabled?: boolean;
  readonly files: readonly File[];
  readonly onChange: (files: File[]) => void;
  readonly slots: number;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const problemsId = useId();
  const [dragging, setDragging] = useState(false);
  const [problems, setProblems] = useState<readonly string[]>([]);

  const add = (incoming: readonly File[]) => {
    const result = acceptFiles(files, incoming, slots);
    setProblems(result.problems);
    onChange(result.files);
  };

  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!disabled) {
      add([...event.dataTransfer.files]);
    }
  };

  const remove = (index: number) => {
    setProblems([]);
    onChange(files.filter((_, position) => position !== index));
  };

  return (
    <div className="portal-picker">
      {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- The drop zone only adds drag and drop; the button inside is the keyboard path. */}
      <div
        className="portal-dropzone"
        data-dragging={dragging || undefined}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDrop={drop}
      >
        <UploadSimple aria-hidden="true" size={20} />
        <p>Drag files here, or</p>
        <button
          aria-describedby={hintId}
          className="btn btn-secondary btn-sm"
          disabled={disabled || files.length >= slots}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          Choose files
        </button>
        <input
          accept={PORTAL_FILE_ACCEPT}
          aria-label="Attach files"
          className="sr-only"
          disabled={disabled}
          multiple
          onChange={(event) => {
            add([...(event.currentTarget.files ?? [])]);
            event.currentTarget.value = "";
          }}
          ref={inputRef}
          tabIndex={-1}
          type="file"
        />
      </div>
      <p className="hint" id={hintId}>
        Images, PDF or MP4. Up to 10 MB each, {slots} more allowed.
      </p>
      {problems.length > 0 ? (
        <ul className="portal-problems" id={problemsId} role="alert">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}
      {files.length > 0 ? (
        <ul aria-label="Files to attach" className="portal-file-list">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.size}-${file.lastModified}`}>
              <FilePreview file={file} />
              <span className="portal-file-name">
                <strong>{file.name}</strong>
                <span className="faint">{formatFileSize(file.size)}</span>
              </span>
              <button
                aria-label={`Remove ${file.name}`}
                className="btn btn-ghost btn-sm"
                disabled={disabled}
                onClick={() => remove(index)}
                type="button"
              >
                <X aria-hidden="true" size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export { PortalFilePicker };
