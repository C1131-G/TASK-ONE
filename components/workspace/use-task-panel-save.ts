"use client";

import { useRouter } from "next/navigation";

import { undoTaskCompletionAction } from "@/app/actions/tasks";
import { useWorkspaceUndo } from "@/components/workspace/workspace-undo";

export const useTaskPanelSave = ({
  onVersionChange,
  refresh,
  taskTitle,
}: {
  readonly onVersionChange: (version: number) => void;
  readonly refresh: () => Promise<void>;
  readonly taskTitle: string;
}) => {
  const router = useRouter();
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
          router.refresh();
          return null;
        },
      });
    }
    router.refresh();
    void refresh();
  };

  return handleSaved;
};
