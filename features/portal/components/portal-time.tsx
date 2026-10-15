"use client";

import { useSyncExternalStore } from "react";

const unsubscribe = () => {
  // The viewer's time zone does not change while the page is open.
};
const subscribe = () => unsubscribe;

const FORMATS = {
  date: {
    local: new Intl.DateTimeFormat("en", { dateStyle: "medium" }),
    utc: new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeZone: "UTC",
    }),
  },
  datetime: {
    local: new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
    }),
    utc: new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }),
  },
} as const;

// Times render in UTC for the server and the first client pass, then switch to
// the viewer's own time zone, so hydration never disagrees.
const PortalTime = ({
  iso,
  variant = "datetime",
}: {
  readonly iso: string;
  readonly variant?: "date" | "datetime";
}) => {
  const local = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const text = FORMATS[variant][local ? "local" : "utc"].format(date);
  return <time dateTime={iso}>{text}</time>;
};

export { PortalTime };
