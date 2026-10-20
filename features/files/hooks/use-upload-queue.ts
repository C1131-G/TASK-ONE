"use client";

import { useCreateStore, useSelector } from "@tanstack/react-store";
import { useEffect, useRef } from "react";

import { uploadActions } from "../upload-store";
import { putWithProgress } from "../upload-transport";

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
  const store = useCreateStore({ uploads: [] }, uploadActions);
  const entries = useRef(new Map<string, Entry>());
  const mounted = useRef(true);
  const uploads = useSelector(store, (state) => state.uploads);

  useEffect(() => {
    const activeEntries = entries;
    const activeState = mounted;
    mounted.current = true;
    return () => {
      activeState.current = false;
      for (const entry of activeEntries.current.values()) {
        entry.controller.abort();
      }
      activeEntries.current.clear();
    };
  }, []);

  const run = async (id: string, entry: Entry) => {
    const { actions } = store;
    let finalized = false;
    try {
      const attempt = entry.runner(entry.file);
      const ticket = await attempt.request();
      if (!mounted.current) {
        return;
      }
      if (entry.controller.signal.aborted) {
        actions.cancelled(id);
        return;
      }
      if (ticket.ok) {
        const result = await putWithProgress(
          ticket.ticket.uploadUrl,
          ticket.ticket.requiredHeaders,
          entry.file,
          (loaded) => {
            if (mounted.current) {
              actions.progress(id, loaded);
            }
          },
          entry.controller.signal
        );
        if (!mounted.current) {
          return;
        }
        if (result === "aborted" || entry.controller.signal.aborted) {
          actions.cancelled(id);
          return;
        } else if (result === "failed") {
          actions.failed(id, FAILED_MESSAGE(entry.file.name));
        } else {
          actions.finalizing(id);
          const message = await attempt.finalize();
          if (!mounted.current) {
            return;
          }
          if (message) {
            actions.failed(id, message);
          } else {
            finalized = true;
          }
        }
      } else if (mounted.current) {
        actions.failed(id, ticket.message);
      }
    } catch {
      if (mounted.current) {
        actions.failed(id, FAILED_MESSAGE(entry.file.name));
      }
    }
    if (mounted.current) {
      try {
        await onSettled?.(id);
        if (finalized && mounted.current) {
          actions.done(id);
        }
      } catch {
        if (finalized && mounted.current) {
          actions.refreshFailed(id);
        }
      }
    }
  };

  const start = (file: File, runner: (file: File) => UploadRunner) => {
    const id = crypto.randomUUID();
    const entry: Entry = { controller: new AbortController(), file, runner };
    entries.current.set(id, entry);
    store.actions.add({ id, name: file.name, sizeBytes: file.size });
    return run(id, entry);
  };

  const cancel = (id: string) => {
    if (
      store.state.uploads.find((upload) => upload.id === id)?.status ===
      "uploading"
    ) {
      entries.current.get(id)?.controller.abort();
    }
  };

  const retry = async (id: string) => {
    if (
      store.state.uploads.find((upload) => upload.id === id)?.status ===
      "refresh-error"
    ) {
      store.actions.finalizing(id);
      try {
        await onSettled?.(id);
        if (mounted.current) {
          store.actions.done(id);
        }
      } catch {
        if (mounted.current) {
          store.actions.refreshFailed(id);
        }
      }
      return;
    }
    const previous = entries.current.get(id);
    if (!previous) {
      return;
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
    for (const upload of store.state.uploads) {
      if (upload.status !== "uploading" && upload.status !== "finalizing") {
        entries.current.delete(upload.id);
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
