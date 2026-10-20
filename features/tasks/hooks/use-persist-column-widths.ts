"use client";

import { useEffect, useRef, useState } from "react";

import type { TaskTableColumnId } from "@/features/tasks/task-table-columns";
import { saveTaskTableColumnWidthsAction } from "@/features/user/user-actions";

const SAVE_DELAY_MS = 600;

// Saves column widths once resizing settles. Widths seeded from the server are
// already stored, so they are not written back.
export const usePersistColumnWidths = (
  columnWidths: Partial<Record<TaskTableColumnId, number>>
): { readonly error: string | null; readonly handleRetry: () => void } => {
  const lastSaved = useRef<string | null>(null);
  const latestWidths = useRef(columnWidths);
  const saving = useRef(false);
  const mounted = useRef(false);
  const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    latestWidths.current = columnWidths;
  }, [columnWidths]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const serialized = JSON.stringify(columnWidths);
    if (lastSaved.current === null) {
      lastSaved.current = serialized;
      return;
    }
    if (serialized === lastSaved.current) {
      return;
    }

    let timer: number | null = null;
    const persistLatest = async (): Promise<void> => {
      if (saving.current) {
        return;
      }
      saving.current = true;
      let saved = false;
      const widths = latestWidths.current;
      const currentSerialized = JSON.stringify(widths);
      try {
        const result = await saveTaskTableColumnWidthsAction({
          columnWidths: widths,
          idempotencyKey: crypto.randomUUID(),
        });
        if (result.ok) {
          lastSaved.current = currentSerialized;
          saved = true;
          if (mounted.current) {
            setError(null);
          }
        } else if (mounted.current) {
          setError("Column widths could not be saved. Retry to save them.");
        }
      } catch {
        if (mounted.current) {
          setError("Column widths could not be saved. Retry to save them.");
        }
      }
      saving.current = false;
      if (
        saved &&
        mounted.current &&
        JSON.stringify(latestWidths.current) !== lastSaved.current
      ) {
        timer = window.setTimeout(persistLatest, SAVE_DELAY_MS);
      }
    };

    timer = window.setTimeout(() => {
      void persistLatest();
    }, SAVE_DELAY_MS);
    return () => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
    // Retry deliberately replays persistence without changing the store value.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [columnWidths, retryCount]);

  return {
    error,
    handleRetry: () => setRetryCount((count) => count + 1),
  };
};
