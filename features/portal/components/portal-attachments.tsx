"use client";

/* eslint-disable shadcn/no-unknown-classes -- Portal classes are authored in app/workspace-styles/portal.css. */

import { Paperclip } from "@phosphor-icons/react";
import { useState } from "react";

import { PortalFilePicker } from "@/features/portal/components/portal-file-picker";
import {
  clearFailedUpload,
  recordFailedUploads,
  useFailedUploads,
} from "@/features/portal/portal-failed-uploads";
import {
  uploadPortalFile,
  uploadPortalFiles,
} from "@/features/portal/portal-upload";
import { PORTAL_MAX_FILES_PER_BUG } from "@/features/portal/portal-upload-rules";

import type { Attachment } from "./portal-attachment-card";
import { AttachmentCard } from "./portal-attachment-card";

const FailedUploads = ({
  bugId,
  canAttach,
}: {
  readonly bugId: string;
  readonly canAttach: boolean;
}) => {
  const failed = useFailedUploads(bugId);
  const [retrying, setRetrying] = useState<string>();

  if (failed.length === 0) {
    return null;
  }

  const retry = async (id: string) => {
    const entry = failed.find((item) => item.id === id);
    if (!entry) {
      return;
    }
    setRetrying(id);
    const result = await uploadPortalFile(bugId, entry.file);
    setRetrying(undefined);
    clearFailedUpload(bugId, id);
    if (!result.ok) {
      recordFailedUploads(bugId, [
        { file: entry.file, message: result.message },
      ]);
    }
  };

  return (
    <div className="portal-failed" role="alert">
      <strong>
        {failed.length === 1
          ? "1 file could not be uploaded"
          : `${failed.length} files could not be uploaded`}
      </strong>
      <ul>
        {failed.map((entry) => (
          <li key={entry.id}>
            <span className="portal-file-name">
              <strong>{entry.file.name}</strong>
              <span>{entry.message}</span>
            </span>
            {canAttach ? (
              <button
                className="btn btn-secondary btn-sm"
                disabled={retrying !== undefined}
                onClick={() => retry(entry.id)}
                type="button"
              >
                {retrying === entry.id ? "Retrying…" : "Retry"}
              </button>
            ) : null}
            <button
              className="btn btn-ghost btn-sm"
              disabled={retrying === entry.id}
              onClick={() => clearFailedUpload(bugId, entry.id)}
              type="button"
            >
              Dismiss
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

const AddAttachments = ({
  bugId,
  slots,
}: {
  readonly bugId: string;
  readonly slots: number;
}) => {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");

  const upload = async () => {
    setPending(true);
    const failures = await uploadPortalFiles(bugId, files, (index, file) =>
      setStatus(`Uploading file ${index + 1} of ${files.length}: ${file.name}`)
    );
    recordFailedUploads(bugId, failures);
    setStatus(
      failures.length === 0 ? "Files uploaded." : "Some files did not upload."
    );
    setFiles([]);
    setPending(false);
    setOpen(false);
  };

  if (!open) {
    return (
      <div>
        <button
          className="btn btn-secondary btn-sm"
          disabled={slots <= 0}
          onClick={() => setOpen(true)}
          type="button"
        >
          <Paperclip aria-hidden="true" size={14} />
          Add attachment
        </button>
        {slots <= 0 ? (
          <p className="hint">
            This bug has reached the limit of {PORTAL_MAX_FILES_PER_BUG}{" "}
            attachments.
          </p>
        ) : null}
        <output aria-live="polite" className="hint">
          {status}
        </output>
      </div>
    );
  }
  return (
    <div className="portal-add">
      <PortalFilePicker
        disabled={pending}
        files={files}
        onChange={setFiles}
        slots={slots}
      />
      <output aria-live="polite" className="muted">
        {status}
      </output>
      <div className="portal-form-acts">
        <button
          className="btn btn-primary btn-sm"
          disabled={pending || files.length === 0}
          onClick={upload}
          type="button"
        >
          {pending ? "Uploading…" : "Upload"}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setFiles([]);
          }}
          type="button"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

const PortalAttachments = ({
  attachments,
  bugId,
  canAttach,
  previewUrls,
}: {
  readonly attachments: readonly Attachment[];
  readonly bugId: string;
  readonly canAttach: boolean;
  readonly previewUrls: Readonly<Record<string, string | null>>;
}) => (
  <section
    aria-labelledby="portal-attachments-h"
    className="panel portal-panel"
  >
    <h2 className="sec" id="portal-attachments-h">
      Attachments
    </h2>
    <FailedUploads bugId={bugId} canAttach={canAttach} />
    {attachments.length > 0 ? (
      <ul className="portal-attachments">
        {attachments.map((attachment) => (
          <AttachmentCard
            attachment={attachment}
            key={attachment.fileId}
            previewUrl={previewUrls[attachment.fileId] ?? null}
          />
        ))}
      </ul>
    ) : (
      <p className="muted">No attachments yet.</p>
    )}
    {canAttach ? (
      <AddAttachments
        bugId={bugId}
        slots={PORTAL_MAX_FILES_PER_BUG - attachments.length}
      />
    ) : null}
  </section>
);

export { PortalAttachments };
