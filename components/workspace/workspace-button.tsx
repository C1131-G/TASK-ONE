import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";

type WorkspaceButtonProps = ComponentProps<typeof Button> & {
  readonly active?: boolean;
  readonly workspace?: boolean;
};

const WorkspaceButton = ({
  active,
  variant = "ghost",
  workspace = false,
  ...props
}: WorkspaceButtonProps) => (
  <Button
    data-active={active || undefined}
    data-workspace={workspace || undefined}
    variant={variant}
    {...props}
  />
);

export { WorkspaceButton };
