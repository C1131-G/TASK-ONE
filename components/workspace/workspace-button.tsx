import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";

const WorkspaceButton = ({
  variant = "ghost",
  ...props
}: ComponentProps<typeof Button>) => <Button variant={variant} {...props} />;

export { WorkspaceButton };
