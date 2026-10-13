/* eslint-disable shadcn/no-unknown-classes */

"use client";

import Image from "next/image";
import { useRef, useState } from "react";

import {
  finalizeAvatarUploadAction,
  getAvatarDownloadUrlAction,
  requestAvatarUploadAction,
} from "@/app/actions/uploads";
import { UploadProgressList } from "@/components/workspace/upload-progress-list";
import { useUploadQueue } from "@/components/workspace/use-upload-queue";
import type { UploadRunner } from "@/components/workspace/use-upload-queue";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";

export const AvatarUpload = ({
  userId,
  initialUrl,
}: {
  readonly userId: string;
  readonly initialUrl: string | null;
}) => {
  const [avatarUrl, setAvatarUrl] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const queue = useUploadQueue();
  const pending = queue.uploads.some((item) => item.status === "uploading");

  const runner = (file: File): UploadRunner => {
    let uploadIntentId = "";
    return {
      finalize: async () => {
        const finalized = await finalizeAvatarUploadAction({
          idempotencyKey: crypto.randomUUID(),
          uploadIntentId,
        });
        if (!finalized.ok) {
          return finalized.error.message;
        }
        const avatar = await getAvatarDownloadUrlAction({ userId });
        if (!avatar.ok) {
          return avatar.error.message;
        }
        setAvatarUrl(avatar.data);
        return null;
      },
      request: async () => {
        const ticket = await requestAvatarUploadAction({
          contentType: file.type,
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
    if (file.size > 5 * 1024 * 1024) {
      setError("Profile photos must be 5 MB or smaller.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    queue.start(file, runner);
  };

  return (
    <div className="row avatar-upload">
      {avatarUrl ? (
        <Image
          alt="Your profile photo"
          className="av lg"
          height={48}
          src={avatarUrl}
          unoptimized
          width={48}
        />
      ) : (
        <span aria-hidden="true" className="av lg">
          M
        </span>
      )}
      <WorkspaceButton
        disabled={pending}
        onClick={() => uploadInput.current?.click()}
        size="sm"
        type="button"
        variant="secondary"
        workspace
      >
        {pending ? "Uploading…" : "Change photo"}
      </WorkspaceButton>
      <WorkspaceInput
        accept="image/jpeg,image/png,image/webp"
        aria-label="Choose a profile photo"
        className="sr-only"
        disabled={pending}
        onChange={(event) => {
          upload(event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
        ref={uploadInput}
        type="file"
      />
      {error ? (
        <span className="error" role="alert">
          {error}
        </span>
      ) : null}
      <UploadProgressList
        onCancel={queue.handleCancel}
        onClearFinished={queue.handleClearFinished}
        onDismiss={queue.handleDismiss}
        onRetry={queue.handleRetry}
        uploads={queue.uploads}
      />
    </div>
  );
};
