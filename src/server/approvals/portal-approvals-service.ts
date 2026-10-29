import type { Effect } from "effect";
import { Context } from "effect";

import type { AppError } from "../core/action-result";
import type { PortalActor } from "../portal/portal-contracts";
import type {
  ApprovalDecisionReceipt,
  DecideApprovalInput,
  PortalApprovalDetail,
  PortalApprovalSummary,
} from "./approval-contracts";

export class PortalApprovals extends Context.Service<
  PortalApprovals,
  {
    readonly list: (
      actor: PortalActor
    ) => Effect.Effect<readonly PortalApprovalSummary[], AppError>;
    readonly pendingCount: (
      actor: PortalActor
    ) => Effect.Effect<number, AppError>;
    readonly get: (
      actor: PortalActor,
      approvalId: string
    ) => Effect.Effect<PortalApprovalDetail, AppError>;
    readonly decide: (
      actor: PortalActor,
      input: DecideApprovalInput
    ) => Effect.Effect<ApprovalDecisionReceipt, AppError>;
  }
>()("taskora/server/PortalApprovals") {}
