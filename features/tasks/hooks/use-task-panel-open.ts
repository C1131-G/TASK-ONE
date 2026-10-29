"use client";

import { useCallback, useRef, useState } from "react";

// What the task panel needs to know about a comment the person has started.
interface CommentDraft {
  readonly hasText: boolean;
  readonly reset: () => void;
}

// Owns whether the panel is open, the unsaved-details flag and the discard
// prompt. When `open` is passed, the caller owns the open state (for example a
// drawer driven by the URL); otherwise the panel keeps it itself. Closing with
// unsaved details or a comment draft asks before anything is thrown away.
export const useTaskPanelOpen = ({
  commentDraft,
  hasInitialBundle,
  onOpenChange,
  open,
  refresh,
}: {
  readonly commentDraft: CommentDraft;
  readonly hasInitialBundle: boolean;
  readonly onOpenChange?: ((open: boolean) => void) | undefined;
  readonly open?: boolean | undefined;
  readonly refresh: () => void;
}) => {
  const [localOpen, setLocalOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const isOpen = open ?? localOpen;
  // A ref, not state: the dirty flag only decides what a close does.
  const detailsDirtyRef = useRef(false);
  const setDetailsDirty = useCallback((dirty: boolean) => {
    detailsDirtyRef.current = dirty;
  }, []);

  const setOpen = (next: boolean) => {
    if (open === undefined) {
      setLocalOpen(next);
    }
    onOpenChange?.(next);
  };

  const requestOpenChange = (next: boolean) => {
    if (next) {
      if (!isOpen && !hasInitialBundle) {
        refresh();
      }
      setOpen(true);
      return;
    }
    if (detailsDirtyRef.current || commentDraft.hasText) {
      setDiscardOpen(true);
      return;
    }
    setOpen(false);
  };

  const discardAndClose = () => {
    setDiscardOpen(false);
    commentDraft.reset();
    detailsDirtyRef.current = false;
    setOpen(false);
  };

  return {
    discardAndClose,
    discardOpen,
    isOpen,
    requestOpenChange,
    setDetailsDirty,
    setDiscardOpen,
  };
};
