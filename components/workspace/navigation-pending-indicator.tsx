/* eslint-disable shadcn/no-unknown-classes -- Indicator is styled in workspace CSS. */

"use client";

import { useLinkStatus } from "next/link";

const NavigationPendingIndicator = () => {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className="nav-pending"
      data-pending={pending ? "true" : undefined}
    />
  );
};

export { NavigationPendingIndicator };
