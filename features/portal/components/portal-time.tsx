"use client";

import { LocalTime } from "@/components/workspace/local-time";

// Portal times follow the shared viewer-zone rendering: UTC for the server
// and the first client pass, then the viewer's own time zone.
const PortalTime = ({
  iso,
  variant = "datetime",
}: {
  readonly iso: string;
  readonly variant?: "date" | "datetime";
}) => (
  <LocalTime format={variant === "date" ? "date" : "dateTime"} value={iso} />
);

export { PortalTime };
