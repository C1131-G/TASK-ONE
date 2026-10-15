import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";

type WorkspaceButtonProps = ComponentProps<typeof Button> & {
  readonly active?: boolean;
  readonly workspace?: boolean;
};

const getLegacyVariant = (className?: string) => {
  if (!className) {
    return;
  }

  for (const classNameToken of className.split(/\s+/u)) {
    switch (classNameToken) {
      case "btn-primary": {
        return "default";
      }
      case "btn-secondary": {
        return "secondary";
      }
      case "btn-danger": {
        return "destructive";
      }
      case "btn-ghost":
      case "btn-danger-ghost": {
        return "ghost";
      }
      default: {
        break;
      }
    }
  }
};

const getLegacySize = (className?: string) => {
  if (!className) {
    return;
  }

  for (const classNameToken of className.split(/\s+/u)) {
    switch (classNameToken) {
      case "btn-lg": {
        return "lg";
      }
      case "btn-xs": {
        return "xs";
      }
      case "btn-sm": {
        return "sm";
      }
      default: {
        break;
      }
    }
  }
};

const WorkspaceButton = ({
  active,
  className,
  size,
  variant,
  workspace = false,
  ...props
}: WorkspaceButtonProps) => (
  <Button
    data-active={active || undefined}
    data-workspace={workspace || undefined}
    className={className}
    size={size ?? getLegacySize(className)}
    variant={variant ?? getLegacyVariant(className) ?? "ghost"}
    {...props}
  />
);

export { WorkspaceButton };
