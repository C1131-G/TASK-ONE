"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import { WorkspaceModal } from "@/components/workspace/workspace-modal";

const WorkspaceDisclosure = ({
  children,
  description,
  title,
  trigger,
}: {
  // A function child receives close, so a form can dismiss the dialog once its
  // action succeeds.
  readonly children: ReactNode | ((close: () => void) => ReactNode);
  readonly description: string;
  readonly title: string;
  readonly trigger: ReactNode;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <WorkspaceModal
      description={description}
      onOpenChange={setOpen}
      open={open}
      title={title}
      trigger={trigger}
    >
      {typeof children === "function"
        ? children(() => setOpen(false))
        : children}
    </WorkspaceModal>
  );
};

export { WorkspaceDisclosure };
