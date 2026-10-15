import type { PortalBugDetail } from "@/src/server/portal/portal-contracts";

// True when a lifecycle banner already explains the bug's state, so the plain
// read-only note would only repeat or contradict it.
export const hasLifecycleBanner = (bug: PortalBugDetail) => {
  const { lifecycle } = bug;
  return Boolean(
    lifecycle.question ||
    lifecycle.verification ||
    lifecycle.duplicateOf ||
    bug.status === "closed" ||
    bug.status === "not_a_bug"
  );
};
