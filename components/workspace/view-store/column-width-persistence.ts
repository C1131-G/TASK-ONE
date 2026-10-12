"use client";

import { useEffect, useRef } from "react";

import { saveTaskTableColumnWidthsAction } from "@/app/actions/personal-preferences";

import type { TaskTableColumnId } from "../task-table-columns";

const SAVE_DELAY_MS = 600;

// Saves column widths once resizing settles. Widths seeded from the server are
// already stored, so they are not written back.
export const usePersistColumnWidths = (
  columnWidths: Partial<Record<TaskTableColumnId, number>>
): void => {
  // The first run records the seeded widths as the baseline and saves nothing.
  const lastSaved = useRef<string | null>(null);

  useEffect(() => {
    const serialized = JSON.stringify(columnWidths);
    if (lastSaved.current === null) {
      lastSaved.current = serialized;
      return;
    }
    if (serialized === lastSaved.current) {
      return;
    }
    const timer = window.setTimeout(async () => {
      lastSaved.current = serialized;
      try {
        await saveTaskTableColumnWidthsAction({
          columnWidths,
          idempotencyKey: crypto.randomUUID(),
        });
      } catch {
        // The widths stay on screen; the next resize tries the save again.
      }
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [columnWidths]);
};
