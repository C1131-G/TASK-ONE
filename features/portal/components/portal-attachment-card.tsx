"use client";

/* eslint-disable shadcn/no-unknown-classes -- Portal classes are authored in app/workspace-styles/portal.css. */

import { DownloadSimple, FilePdf, FileVideo } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { getPortalFileUrlAction } from "@/features/portal/portal-actions";
import { formatFileSize } from "@/features/portal/portal-upload-rules";
import type { PortalBugDetail } from "@/src/server/portal/portal-contracts";

export type Attachment = PortalBugDetail["attachments"][number];

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

export const AttachmentCard = ({
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
