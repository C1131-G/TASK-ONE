"use client";

import { RouteError } from "@/components/ui/route-error";

const WorkspaceError = ({ reset }: { readonly reset: () => void }) => (
  <RouteError reset={reset} title="Workspace unavailable" />
);

export default WorkspaceError;
