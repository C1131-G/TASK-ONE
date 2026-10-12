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
  readonly children: ReactNode;
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
      {children}
    </WorkspaceModal>
  );
};

export { WorkspaceDisclosure };
