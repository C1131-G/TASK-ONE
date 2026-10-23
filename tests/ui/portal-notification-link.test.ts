import { expect, it } from "bun:test";

import { portalNotificationHref } from "../../features/portal/portal-notification-link";

const APPROVAL = "2f1b8d7e-6a52-4f0e-9d0e-2b6f0a5c4e11";
const BUG = "7c3d9a10-1b2e-4c5d-8e9f-0a1b2c3d4e5f";

it("opens the approval page for an approval notification", () => {
  expect(portalNotificationHref({ approvalId: APPROVAL, bugId: null })).toBe(
    `/portal/approvals/${APPROVAL}`
  );
});

it("opens the bug page for a bug notification", () => {
  expect(portalNotificationHref({ approvalId: null, bugId: BUG })).toBe(
    `/portal/bugs/${BUG}`
  );
});

it("offers no link when the notification names neither", () => {
  expect(portalNotificationHref({ approvalId: null, bugId: null })).toBeNull();
});
