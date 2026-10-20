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

interface ConfirmCopy {
  readonly confirmLabel: string;
  readonly description: string;
  readonly onConfirm: () => void;
  readonly title: string;
}

// A trigger child opens the dialog itself; without one the caller controls it,
// e.g. to confirm a select change before submitting it.
type ConfirmOpening =
  | {
      readonly children: ReactNode;
      readonly onOpenChange?: never;
      readonly open?: never;
    }
  | {
      readonly children?: never;
      readonly onOpenChange: (open: boolean) => void;
      readonly open: boolean;
    };

const WorkspaceConfirmDialog = ({
  children,
  confirmLabel,
  description,
  onConfirm,
  title,
  ...openState
}: ConfirmCopy & ConfirmOpening) => (
  <AlertDialog {...openState}>
    {children ? (
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
    ) : null}
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
