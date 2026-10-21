"use client";

import { useState, useTransition } from "react";

import { useWorkspaceUndo } from "@/components/workspace/workspace-undo";

// Pending/error state for a settings form, plus the polite "Saved" notice a
// successful save would otherwise leave out.
const useSaveState = () => {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { notifySaved } = useWorkspaceUndo();
  const saved = (label: string): void => {
    setError(null);
    notifySaved(label);
  };
  return { error, pending, saved, setError, startTransition };
};

export { useSaveState };
