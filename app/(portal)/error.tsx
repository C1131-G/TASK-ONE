"use client";

import { RouteError } from "@/components/ui/route-error";

const PortalError = ({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) => {
  void error;
  return <RouteError reset={reset} title="Portal unavailable" />;
};

export default PortalError;
