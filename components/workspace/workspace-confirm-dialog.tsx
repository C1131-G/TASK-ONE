"use client";

import type { ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const WorkspaceConfirmDialog = ({
  children,
  confirmLabel,
  description,
  onConfirm,
  title,
}: {
  readonly children: ReactNode;
  readonly confirmLabel: string;
  readonly description: string;
  readonly onConfirm: () => void;
  readonly title: string;
}) => (
  <AlertDialog>
    <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
    <AlertDialogContent data-workspace-confirm="">
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel size="sm">Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm} size="sm" variant="destructive">
          {confirmLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export { WorkspaceConfirmDialog };
