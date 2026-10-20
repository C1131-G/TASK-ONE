"use client";

/* eslint-disable shadcn/no-restyle, shadcn/no-unknown-classes */

import { X } from "@phosphor-icons/react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

interface UndoNoticeInput {
  readonly expiresAt: string;
  readonly label: string;
  readonly run: () => Promise<string | null>;
}

interface UndoNotice extends UndoNoticeInput {
  readonly id: string;
  readonly error: string | null;
}

// A confirmation with nothing to undo, such as "Settings saved".
interface SavedNotice {
  readonly id: string;
  readonly label: string;
}

interface WorkspaceUndoContextValue {
  readonly addUndo: (notice: UndoNoticeInput) => void;
  readonly notifySaved: (label: string) => void;
}

// Saved confirmations need no action, so they leave on their own.
const SAVED_NOTICE_MS = 4000;

const WorkspaceUndoContext = createContext<WorkspaceUndoContextValue | null>(
  null
);

const WorkspaceUndoNotices = ({
  items,
  onDismiss,
  onDismissSaved,
  onUndo,
  pendingId,
  announcement,
  savedNotices,
}: {
  readonly items: readonly UndoNotice[];
  readonly onDismiss: (id: string) => void;
  readonly onDismissSaved: (id: string) => void;
  readonly onUndo: (id: string) => void;
  readonly pendingId: string | null;
  readonly announcement: string;
  readonly savedNotices: readonly SavedNotice[];
}) => (
  <>
    <output aria-atomic="true" aria-live="polite" className="sr-only">
      {announcement}
    </output>
    {items.length || savedNotices.length ? (
      <section aria-label="Recent actions" className="workspace-undo-stack">
        {/* oxlint-disable-next-line jsx-a11y/no-redundant-roles -- Safari drops list semantics when list-style is none. */}
        <ul className="workspace-undo-list" role="list">
          {savedNotices.map(({ id, label }) => (
            <li className="workspace-undo-item" key={id}>
              <div className="workspace-undo-copy">
                <span>{label}</span>
              </div>
              <Button
                aria-label={`Dismiss ${label}`}
                className="workspace-undo-dismiss"
                onClick={() => onDismissSaved(id)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <X aria-hidden="true" size={14} />
              </Button>
            </li>
          ))}
          {items.map(({ error, expiresAt, id, label }) => (
            <li className="workspace-undo-item" key={id}>
              <div className="workspace-undo-copy">
                <span>{label}</span>
                <span className="faint">
                  {error ??
                    `Undo available until ${new Date(expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
                </span>
              </div>
              <Button
                className="workspace-undo-button"
                disabled={pendingId !== null || error !== null}
                onClick={() => onUndo(id)}
                size="sm"
                type="button"
                variant="secondary"
              >
                {pendingId === id ? "Undoing…" : "Undo"}
              </Button>
              <Button
                aria-label={`Dismiss ${label}`}
                className="workspace-undo-dismiss"
                disabled={pendingId === id}
                onClick={() => onDismiss(id)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <X aria-hidden="true" size={14} />
              </Button>
            </li>
          ))}
        </ul>
      </section>
    ) : null}
  </>
);

const WorkspaceUndoProvider = ({
  children,
}: {
  readonly children: ReactNode;
}) => {
  const [items, setItems] = useState<readonly UndoNotice[]>([]);
  const [savedNotices, setSavedNotices] = useState<readonly SavedNotice[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const dismissSaved = useCallback((id: string) => {
    setSavedNotices((current) => current.filter((notice) => notice.id !== id));
  }, []);

  const notifySaved = useCallback(
    (label: string) => {
      const id = crypto.randomUUID();
      setSavedNotices((current) => [...current, { id, label }]);
      setAnnouncement(label);
      setTimeout(() => dismissSaved(id), SAVED_NOTICE_MS);
    },
    [dismissSaved]
  );

  const addUndo = useCallback((notice: UndoNoticeInput) => {
    setItems((current) => [
      ...current,
      { ...notice, error: null, id: crypto.randomUUID() },
    ]);
    setAnnouncement(
      `${notice.label}. Undo is available until ${new Date(notice.expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`
    );
  }, []);

  const dismiss = (id: string) => {
    const notice = items.find((undoNotice) => undoNotice.id === id);
    setItems((current) => current.filter((undoNotice) => undoNotice.id !== id));
    if (notice) {
      setAnnouncement(`${notice.label} dismissed.`);
    }
  };

  const runUndo = async (id: string) => {
    const undoNotice = items.find((notice) => notice.id === id);
    if (!undoNotice || pendingId !== null) {
      return;
    }
    setPendingId(id);
    const error = await undoNotice
      .run()
      .catch(() => "Undo failed. Refresh and try again.");
    if (error) {
      setAnnouncement(`${undoNotice.label}. ${error}`);
      setItems((current) =>
        current.map((notice) =>
          notice.id === id ? { ...notice, error } : notice
        )
      );
    } else {
      dismiss(id);
      setAnnouncement(`Undid ${undoNotice.label}.`);
    }
    setPendingId(null);
  };

  const contextValue = useMemo(
    () => ({ addUndo, notifySaved }),
    [addUndo, notifySaved]
  );

  return (
    <WorkspaceUndoContext.Provider value={contextValue}>
      {children}
      <WorkspaceUndoNotices
        announcement={announcement}
        items={items}
        onDismiss={dismiss}
        onDismissSaved={dismissSaved}
        onUndo={runUndo}
        pendingId={pendingId}
        savedNotices={savedNotices}
      />
    </WorkspaceUndoContext.Provider>
  );
};

const useWorkspaceUndo = () => {
  const context = useContext(WorkspaceUndoContext);
  if (!context) {
    throw new Error(
      "useWorkspaceUndo must be used within WorkspaceUndoProvider."
    );
  }
  return context;
};

export { WorkspaceUndoProvider, useWorkspaceUndo };
