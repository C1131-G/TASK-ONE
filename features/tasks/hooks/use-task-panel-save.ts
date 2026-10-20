"use client";

import { useWorkspaceUndo } from "@/components/workspace/workspace-undo";
import { undoTaskCompletionAction } from "@/features/tasks/tasks-actions";

export const useTaskPanelSave = ({
  onVersionChange,
  refresh,
  taskTitle,
}: {
  readonly onVersionChange: (version: number) => void;
  readonly refresh: () => Promise<void>;
  readonly taskTitle: string;
}) => {
  const { addUndo } = useWorkspaceUndo();

  const handleSaved = (
    nextVersion: number,
    completionUndo: {
      readonly undoId: string;
      readonly expiresAt: string;
    } | null
  ) => {
    onVersionChange(nextVersion);
    if (completionUndo) {
      addUndo({
        expiresAt: completionUndo.expiresAt,
        label: `Completed “${taskTitle}”`,
        run: async () => {
          const result = await undoTaskCompletionAction({
            idempotencyKey: crypto.randomUUID(),
            undoId: completionUndo.undoId,
          });
          if (!result.ok) {
            return result.error.message;
          }
          return null;
        },
      });
    }
    void refresh();
  };

  return handleSaved;
};
