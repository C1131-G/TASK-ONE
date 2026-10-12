/* eslint-disable shadcn/no-unknown-classes */

"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";

import {
  finalizeAvatarUploadAction,
  getAvatarDownloadUrlAction,
  requestAvatarUploadAction,
} from "@/app/actions/uploads";
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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const uploadInput = useRef<HTMLInputElement>(null);

  const upload = (file: File | undefined) => {
    if (!file) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        if (file.size > 5 * 1024 * 1024) {
          setError("Profile photos must be 5 MB or smaller.");
          return;
        }
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
          setError("Choose a JPEG, PNG, or WebP image.");
          return;
        }
        const ticket = await requestAvatarUploadAction({
          contentType: file.type,
          sizeBytes: file.size,
        });
        if (!ticket.ok) {
          setError(ticket.error.message);
          return;
        }
        const response = await fetch(ticket.data.uploadUrl, {
          body: file,
          headers: ticket.data.requiredHeaders,
          method: "PUT",
        });
        if (!response.ok) {
          setError(
            "The photo upload failed. Check storage settings and try again."
          );
          return;
        }
        const finalized = await finalizeAvatarUploadAction({
          idempotencyKey: crypto.randomUUID(),
          uploadIntentId: ticket.data.uploadIntentId,
        });
        if (!finalized.ok) {
          setError(finalized.error.message);
          return;
        }
        const avatar = await getAvatarDownloadUrlAction({ userId });
        if (!avatar.ok) {
          setError(avatar.error.message);
          return;
        }
        setAvatarUrl(avatar.data);
      } catch {
        setError(
          "The photo upload failed. Check storage settings and try again."
        );
      }
    });
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
    </div>
  );
};
