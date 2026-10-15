/* eslint-disable shadcn/no-unknown-classes -- Client classes are authored in app/workspace-styles/clients.css. */

"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceConfirmDialog } from "@/components/workspace/workspace-confirm-dialog";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import {
  finalizeClientLogoUploadAction,
  removeClientLogoAction,
  requestClientLogoUploadAction,
} from "@/features/clients/client-logo-actions";
import type { VersionSink } from "@/features/clients/components/client-company-forms";
import { UploadProgressList } from "@/features/files/components/upload-progress-list";
import { useUploadQueue } from "@/features/files/hooks/use-upload-queue";
import type { UploadRunner } from "@/features/files/hooks/use-upload-queue";

const LOGO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

const ClientCompanyLogo = ({
  companyId,
  companyName,
  logoUrl,
  onVersion,
  version,
}: {
  readonly companyId: string;
  readonly companyName: string;
  readonly logoUrl: string | null;
  readonly onVersion: VersionSink;
  readonly version: number;
}) => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [removing, startRemoval] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  // The upload finishes after renders that may carry a newer version.
  const latestVersion = useRef(version);
  useEffect(() => {
    latestVersion.current = version;
  }, [version]);
  const queue = useUploadQueue();
  const uploading = queue.uploads.some(
    (upload) => upload.status === "uploading"
  );
  const busy = uploading || removing;
  const inputId = `client-company-${companyId}-logo`;
  let uploadLabel = logoUrl ? "Replace" : "Upload logo";
  if (uploading) {
    uploadLabel = "Uploading…";
  }

  const runner = (file: File): UploadRunner => {
    let uploadIntentId = "";
    return {
      finalize: async () => {
        const finalized = await finalizeClientLogoUploadAction({
          companyId,
          expectedVersion: latestVersion.current,
          idempotencyKey: crypto.randomUUID(),
          uploadIntentId,
        });
        if (!finalized.ok) {
          return finalized.error.message;
        }
        latestVersion.current = finalized.data.version;
        onVersion(finalized.data.version);
        router.refresh();
        return null;
      },
      request: async () => {
        const ticket = await requestClientLogoUploadAction({
          companyId,
          contentType: file.type,
          idempotencyKey: crypto.randomUUID(),
          sizeBytes: file.size,
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

  const upload = (file: File | undefined) => {
    if (!file) {
      return;
    }
    setError(null);
    if (!LOGO_TYPES.includes(file.type)) {
      setError("Choose a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError("Logos must be 2 MB or smaller.");
      return;
    }
    queue.start(file, runner);
  };

  const remove = () =>
    startRemoval(async () => {
      const result = await removeClientLogoAction({
        companyId,
        expectedVersion: latestVersion.current,
        idempotencyKey: crypto.randomUUID(),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      latestVersion.current = result.data.version;
      onVersion(result.data.version);
      router.refresh();
    });

  return (
    <section
      aria-labelledby="client-logo-heading"
      className="panel clients-panel"
    >
      <div className="panel-h clients-panel-h">
        <div>
          <h2 id="client-logo-heading">Logo</h2>
          <p className="muted">
            Shown next to the company name in the client portal. PNG, JPEG, or
            WebP up to 2 MB.
          </p>
        </div>
      </div>
      <div className="panel-b clients-logo">
        {logoUrl ? (
          <Image
            alt={`${companyName} logo`}
            className="clients-logo-image"
            height={48}
            src={logoUrl}
            unoptimized
            width={160}
          />
        ) : (
          <span className="clients-logo-placeholder">No logo</span>
        )}
        <div className="acts clients-logo-acts">
          <WorkspaceButton
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            size="sm"
            type="button"
            variant="secondary"
            workspace
          >
            {uploadLabel}
          </WorkspaceButton>
          {logoUrl ? (
            <WorkspaceConfirmDialog
              confirmLabel="Remove"
              description={`The portal shows only the name of ${companyName} until a new logo is uploaded.`}
              onConfirm={remove}
              title="Remove logo?"
            >
              <WorkspaceButton
                disabled={busy}
                size="sm"
                type="button"
                variant="ghost"
                workspace
              >
                {removing ? "Removing…" : "Remove"}
              </WorkspaceButton>
            </WorkspaceConfirmDialog>
          ) : null}
        </div>
        <label className="sr-only" htmlFor={inputId}>
          Choose a logo image for {companyName}
        </label>
        <WorkspaceInput
          accept={LOGO_TYPES.join(",")}
          className="sr-only"
          disabled={busy}
          id={inputId}
          onChange={(event) => {
            upload(event.currentTarget.files?.[0]);
            event.currentTarget.value = "";
          }}
          ref={fileInput}
          tabIndex={-1}
          type="file"
        />
      </div>
      {error ? (
        <p className="panel-b error" role="alert">
          {error}
        </p>
      ) : null}
      <UploadProgressList
        onCancel={queue.handleCancel}
        onClearFinished={queue.handleClearFinished}
        onDismiss={queue.handleDismiss}
        onRetry={queue.handleRetry}
        uploads={queue.uploads}
      />
    </section>
  );
};

export { ClientCompanyLogo };
