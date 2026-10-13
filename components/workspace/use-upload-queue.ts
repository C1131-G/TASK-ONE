"use client";

import { useCreateStore, useSelector } from "@tanstack/react-store";
import { useRef } from "react";

import { uploadActions } from "./upload-store";
import type { UploadStore } from "./upload-store";
import { putWithProgress } from "./upload-transport";

export interface UploadTicket {
  readonly uploadUrl: string;
  readonly requiredHeaders: Readonly<Record<string, string>>;
}

// One upload attempt. Returns an error message, or null when it finished.
export interface UploadRunner {
  readonly request: () => Promise<
    | { readonly ok: true; readonly ticket: UploadTicket }
    | { readonly ok: false; readonly message: string }
  >;
  readonly finalize: () => Promise<string | null>;
}

interface Entry {
  readonly controller: AbortController;
  readonly file: File;
  readonly runner: (file: File) => UploadRunner;
}

const FAILED_MESSAGE = (name: string) =>
  `Upload failed for ${name}. Check the storage configuration and try again.`;

// Shared by project files, task attachments and the avatar control: progress,
// cancel and retry live in one TanStack Store per host component.
export const useUploadQueue = (
  onSettled?: (id: string) => void | Promise<void>
) => {
  const store = useCreateStore({ uploads: [] }, uploadActions) as UploadStore;
  const entries = useRef(new Map<string, Entry>());
  const uploads = useSelector(store, (state) => state.uploads);

  const run = async (id: string, entry: Entry) => {
    const { actions } = store;
    try {
      const attempt = entry.runner(entry.file);
      const ticket = await attempt.request();
      if (!ticket.ok) {
        actions.failed(id, ticket.message);
        return;
      }
      const result = await putWithProgress(
        ticket.ticket.uploadUrl,
        ticket.ticket.requiredHeaders,
        entry.file,
        (loaded) => actions.progress(id, loaded),
        entry.controller.signal
      );
      if (result === "aborted") {
        actions.cancelled(id);
        return;
      }
      if (result === "failed") {
        actions.failed(id, FAILED_MESSAGE(entry.file.name));
        return;
      }
      const message = await attempt.finalize();
      if (message) {
        actions.failed(id, message);
        return;
      }
      actions.done(id);
    } catch {
      actions.failed(id, FAILED_MESSAGE(entry.file.name));
    }
    onSettled?.(id);
  };

  const start = (file: File, runner: (file: File) => UploadRunner) => {
    const id = crypto.randomUUID();
    const entry: Entry = { controller: new AbortController(), file, runner };
    entries.current.set(id, entry);
    store.actions.add({ id, name: file.name, sizeBytes: file.size });
    return run(id, entry);
  };

  const cancel = (id: string) => entries.current.get(id)?.controller.abort();

  const retry = (id: string) => {
    const previous = entries.current.get(id);
    if (!previous) {
      return Promise.resolve();
    }
    const entry: Entry = { ...previous, controller: new AbortController() };
    entries.current.set(id, entry);
    store.actions.restart(id);
    return run(id, entry);
  };

  const dismiss = (id: string) => {
    entries.current.delete(id);
    store.actions.dismiss(id);
  };

  const clearFinished = () => {
    for (const item of store.state.uploads) {
      if (item.status !== "uploading") {
        entries.current.delete(item.id);
      }
    }
    store.actions.clearFinished();
  };

  return {
    handleCancel: cancel,
    handleClearFinished: clearFinished,
    handleDismiss: dismiss,
    handleRetry: retry,
    start,
    uploads,
  };
};
