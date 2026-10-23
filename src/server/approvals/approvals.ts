import { Layer } from "effect";

import { Approvals } from "./approval-contracts";
import { decideApproval } from "./approval-decisions";
import {
  getApproval,
  listApprovals,
  pendingCount,
} from "./approval-portal-reads";
import { forProject } from "./approval-project-reads";
import { cancelApproval, requestApproval } from "./approval-requests";
import { forTask } from "./approval-staff-reads";
import { PortalApprovals } from "./portal-approvals-service";

export const ApprovalsLive = Layer.succeed(
  Approvals,
  Approvals.of({
    cancel: cancelApproval,
    forProject,
    forTask,
    request: requestApproval,
  })
);

export const PortalApprovalsLive = Layer.succeed(
  PortalApprovals,
  PortalApprovals.of({
    decide: decideApproval,
    get: getApproval,
    list: listApprovals,
    pendingCount,
  })
);
