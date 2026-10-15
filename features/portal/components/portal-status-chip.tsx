/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import type { ClientStatusLabel } from "@/features/portal/client-status";
import { clientStatusText } from "@/features/portal/client-status";
import { statusTone } from "@/features/portal/portal-format";

const PortalStatusChip = ({
  status,
}: {
  readonly status: ClientStatusLabel;
}) => (
  <span
    className={`badge ${statusTone[status]}`}
    data-attention={
      status === "waiting_for_reply" || status === "fix_ready" || undefined
    }
  >
    <span aria-hidden="true" className="dot" />
    {clientStatusText[status]}
  </span>
);

export { PortalStatusChip };
