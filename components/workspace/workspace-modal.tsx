/* eslint-disable shadcn/no-unknown-classes */

"use client";

import type { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const WorkspaceModal = ({
  children,
  description,
  onOpenChange,
  open,
  title,
  trigger,
}: {
  readonly children: ReactNode;
  readonly description: string;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly title: string;
  readonly trigger: ReactNode | null;
}) => (
  <Dialog onOpenChange={onOpenChange} open={open}>
    {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
    <DialogContent workspace>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      {children}
    </DialogContent>
  </Dialog>
);

export { WorkspaceModal };
