"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { FormEvent } from "react";

import {
  duplicateFileAction,
  getFileDownloadUrlAction,
  getFilePreviewUrlAction,
  listProjectFilesAction,
  listTaskFilesAction,
  removeFileAction,
  renameFileAction,
  undoFileRemovalAction,
} from "@/features/files/files-actions";
import { useUploadQueue } from "@/features/files/hooks/use-upload-queue";
import { uploadRunner } from "@/features/files/project-upload-runner";
import type { ProjectFile } from "@/features/files/types/project-file-types";

// The file list of one project or task, with its uploads, file actions, rename and undo.
export const useProjectFiles = ({
  initialFiles,
  projectId,
  taskId,
}: {
  readonly initialFiles: readonly ProjectFile[];
  readonly projectId: string;
  readonly taskId: string | undefined;
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [files, setFiles] = useState(initialFiles);
  const [error, setError] = useState<string | null>(null);
  const [undo, setUndo] = useState<string | null>(null);
  const [renamingFile, setRenamingFile] = useState<ProjectFile | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const reloadFiles = async () => {
    const result = taskId
      ? await listTaskFilesAction({ taskId })
      : await listProjectFilesAction({ projectId });
    if (result.ok) {
      setFiles(result.data);
    }
  };

  // Each file settles on its own, so the list refreshes as uploads finish.
  const queue = useUploadQueue(async () => {
    await reloadFiles();
    router.refresh();
  });

  const upload = (selectedFiles: FileList | null) => {
    if (!selectedFiles?.length) {
      return;
    }
    setError(null);
    for (const file of selectedFiles) {
      queue.start(file, uploadRunner(projectId, taskId ?? null));
    }
  };

  const actOnFile = (
    fileId: string,
    action: "download" | "preview" | "duplicate" | "remove"
  ) =>
    startTransition(async () => {
      setError(null);
      if (action === "download" || action === "preview") {
        const result =
          action === "download"
            ? await getFileDownloadUrlAction({ fileId })
            : await getFilePreviewUrlAction({ fileId });
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        window.location.assign(result.data);
        return;
      }
      if (action === "duplicate") {
        const result = await duplicateFileAction({
          fileId,
          idempotencyKey: crypto.randomUUID(),
        });
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        await reloadFiles();
        router.refresh();
        return;
      }
      const result = await removeFileAction({
        fileId,
        idempotencyKey: crypto.randomUUID(),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setUndo(result.data.undoId);
      setFiles((current) => current.filter((file) => file.id !== fileId));
    });

  const openRename = (file: ProjectFile) => {
    setError(null);
    setRenamingFile(file);
    setRenameValue(file.originalName);
  };

  const saveRename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!renamingFile) {
      return;
    }
    const currentFile = renamingFile;
    const newName = renameValue.trim();
    if (!newName || newName === currentFile.originalName) {
      setRenamingFile(null);
      return;
    }
    startTransition(async () => {
      setError(null);
      const result = await renameFileAction({
        fileId: currentFile.id,
        fileName: newName,
        idempotencyKey: crypto.randomUUID(),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setFiles((current) =>
        current.map((file) => (file.id === currentFile.id ? result.data : file))
      );
      setRenamingFile(null);
    });
  };

  const undoRemoval = () => {
    if (!undo) {
      return;
    }
    startTransition(async () => {
      const result = await undoFileRemovalAction({
        idempotencyKey: crypto.randomUUID(),
        undoId: undo,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setUndo(null);
      await reloadFiles();
      router.refresh();
    });
  };

  return {
    actOnFile,
    error,
    files,
    openRename,
    pending,
    queue,
    renameValue,
    renamingFile,
    saveRename,
    setError,
    setRenameValue,
    setRenamingFile,
    undo,
    undoRemoval,
    upload,
  };
};
