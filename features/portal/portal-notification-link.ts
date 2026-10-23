type PortalNotificationPath =
  | `/portal/approvals/${string}`
  | `/portal/bugs/${string}`;

// The portal page a notification opens. The server names an approval only
// when this company can open it now, and a bug only when it is the company's
// own, so a present id is always safe to link.
export const portalNotificationHref = ({
  approvalId,
  bugId,
}: {
  readonly approvalId: string | null;
  readonly bugId: string | null;
}): PortalNotificationPath | null => {
  if (approvalId) {
    return `/portal/approvals/${approvalId}`;
  }
  return bugId ? `/portal/bugs/${bugId}` : null;
};
