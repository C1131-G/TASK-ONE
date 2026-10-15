import { useSyncExternalStore } from "react";

export interface FailedUpload {
  readonly id: string;
  readonly file: File;
  readonly message: string;
}

type Listener = () => void;

// Files whose upload failed right after a bug was reported. The report form
// navigates to the bug page, so the failures wait here (in this tab) until the
// bug page shows them with a retry.
const failures = new Map<string, readonly FailedUpload[]>();
const listeners = new Set<Listener>();
const NONE: readonly FailedUpload[] = [];

const emit = () => {
  for (const listener of listeners) {
    listener();
  }
};

const setFailures = (bugId: string, next: readonly FailedUpload[]) => {
  if (next.length === 0) {
    failures.delete(bugId);
  } else {
    failures.set(bugId, next);
  }
  emit();
};

export const recordFailedUploads = (
  bugId: string,
  entries: readonly { readonly file: File; readonly message: string }[]
) => {
  if (entries.length === 0) {
    return;
  }
  setFailures(bugId, [
    ...(failures.get(bugId) ?? NONE),
    ...entries.map((entry) => ({ ...entry, id: crypto.randomUUID() })),
  ]);
};

export const clearFailedUpload = (bugId: string, id: string) => {
  setFailures(
    bugId,
    (failures.get(bugId) ?? NONE).filter((entry) => entry.id !== id)
  );
};

const subscribe = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useFailedUploads = (bugId: string): readonly FailedUpload[] =>
  useSyncExternalStore(
    subscribe,
    () => failures.get(bugId) ?? NONE,
    () => NONE
  );
