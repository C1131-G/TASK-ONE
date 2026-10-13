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

interface WorkspaceUndoContextValue {
  readonly addUndo: (notice: UndoNoticeInput) => void;
}

const WorkspaceUndoContext = createContext<WorkspaceUndoContextValue | null>(
  null
);

const WorkspaceUndoNotices = ({
  items,
  onDismiss,
  onUndo,
  pendingId,
  announcement,
}: {
  readonly items: readonly UndoNotice[];
  readonly onDismiss: (id: string) => void;
  readonly onUndo: (id: string) => void;
  readonly pendingId: string | null;
  readonly announcement: string;
}) => (
  <>
    <output aria-atomic="true" aria-live="polite" className="sr-only">
      {announcement}
    </output>
    {items.length ? (
      <section aria-label="Recent actions" className="workspace-undo-stack">
        {/* oxlint-disable-next-line jsx-a11y/no-redundant-roles -- Safari drops list semantics when list-style is none. */}
        <ul className="workspace-undo-list" role="list">
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
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

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
    const notice = items.find((item) => item.id === id);
    setItems((current) => current.filter((item) => item.id !== id));
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

  const contextValue = useMemo(() => ({ addUndo }), [addUndo]);

  return (
    <WorkspaceUndoContext.Provider value={contextValue}>
      {children}
      <WorkspaceUndoNotices
        announcement={announcement}
        items={items}
        onDismiss={dismiss}
        onUndo={runUndo}
        pendingId={pendingId}
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
