"use client";

/* eslint-disable shadcn/no-unknown-classes -- Portal classes are authored in app/workspace-styles/portal.css. */

import {
  DownloadSimple,
  FilePdf,
  FileVideo,
  Paperclip,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PortalFilePicker } from "@/features/portal/components/portal-file-picker";
import { getPortalFileUrlAction } from "@/features/portal/portal-actions";
import {
  clearFailedUpload,
  recordFailedUploads,
  useFailedUploads,
} from "@/features/portal/portal-failed-uploads";
import {
  uploadPortalFile,
  uploadPortalFiles,
} from "@/features/portal/portal-upload";
import {
  PORTAL_MAX_FILES_PER_BUG,
  formatFileSize,
} from "@/features/portal/portal-upload-rules";
import type { PortalBugDetail } from "@/src/server/portal/portal-contracts";

type Attachment = PortalBugDetail["attachments"][number];

const ImagePreview = ({ attachment }: { readonly attachment: Attachment }) => {
  const [url, setUrl] = useState<string | null>();
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await getPortalFileUrlAction({
          disposition: "preview",
          fileId: attachment.fileId,
        });
        if (!cancelled) {
          setUrl(result.ok ? result.data : null);
        }
      } catch {
        if (!cancelled) {
          setUrl(null);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [attachment.fileId]);

  if (url === undefined) {
    return <span aria-hidden="true" className="sk portal-preview" />;
  }
  if (url === null) {
    return (
      <span className="portal-preview portal-preview-empty">
        Preview unavailable
      </span>
    );
  }
  return (
    <a href={url} rel="noreferrer" target="_blank">
      {/* oxlint-disable-next-line next/no-img-element, react-doctor/nextjs-no-img-element -- A signed storage URL cannot go through the image optimizer. */}
      <img
        alt={`Preview of ${attachment.fileName}`}
        className="portal-preview"
        height={160}
        loading="lazy"
        src={url}
        width={240}
      />
    </a>
  );
};

const DownloadButton = ({
  attachment,
}: {
  readonly attachment: Attachment;
}) => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const download = async () => {
    setPending(true);
    setError("");
    try {
      const result = await getPortalFileUrlAction({
        disposition: "download",
        fileId: attachment.fileId,
      });
      if (result.ok) {
        window.location.assign(result.data);
      } else {
        setError(result.error.message);
      }
    } catch {
      setError("The download could not start. Try again.");
    }
    setPending(false);
  };
  return (
    <>
      <button
        className="btn btn-secondary btn-sm"
        disabled={pending}
        onClick={download}
        type="button"
      >
        <DownloadSimple aria-hidden="true" size={14} />
        {pending ? "Preparing…" : "Download"}
      </button>
      {error ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
};

const AttachmentCard = ({
  attachment,
}: {
  readonly attachment: Attachment;
}) => {
  const isImage =
    attachment.previewable && attachment.contentType.startsWith("image/");
  return (
    <li className="portal-attachment">
      {isImage ? (
        <ImagePreview attachment={attachment} />
      ) : (
        <span aria-hidden="true" className="portal-preview portal-preview-icon">
          {attachment.contentType === "video/mp4" ? (
            <FileVideo size={32} />
          ) : (
            <FilePdf size={32} />
          )}
        </span>
      )}
      <span className="portal-file-name">
        <strong>{attachment.fileName}</strong>
        <span className="faint">
          {formatFileSize(attachment.sizeBytes)} · {attachment.uploaderName}
        </span>
      </span>
      {isImage ? null : <DownloadButton attachment={attachment} />}
    </li>
  );
};

const FailedUploads = ({
  bugId,
  canAttach,
}: {
  readonly bugId: string;
  readonly canAttach: boolean;
}) => {
  const router = useRouter();
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
    if (result.ok) {
      router.refresh();
    } else {
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
  const router = useRouter();
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
    router.refresh();
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
}: {
  readonly attachments: readonly Attachment[];
  readonly bugId: string;
  readonly canAttach: boolean;
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
          <AttachmentCard attachment={attachment} key={attachment.fileId} />
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
