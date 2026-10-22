import "server-only";
import { Effect, Schema } from "effect";
import { cache } from "react";

import { HIDDEN_RECORD_CODES, readRecordOrNotFound } from "@/lib/read-result";
import {
  PortalApprovalDetailSchema,
  PortalApprovalIdInputSchema,
  PortalApprovalListSchema,
} from "@/src/server/approvals/approval-contracts";
import { PortalApprovals } from "@/src/server/approvals/portal-approvals-service";

import { runPortalAction, toPortalActor } from "./portal-action-runner";

export const listPortalApprovals = async (input: unknown) =>
  await runPortalAction(
    input,
    Schema.Struct({}),
    (user) =>
      Effect.gen(function* listPortalApprovalsProgram() {
        const approvals = yield* PortalApprovals;
        return yield* approvals.list(toPortalActor(user));
      }),
    PortalApprovalListSchema,
    { preview: true }
  );

// The number shown beside the Approvals link: requests waiting on the company.
export const getPortalApprovalCount = async (input: unknown) =>
  await runPortalAction(
    input,
    Schema.Struct({}),
    (user) =>
      Effect.gen(function* getPortalApprovalCountProgram() {
        const approvals = yield* PortalApprovals;
        return yield* approvals.pendingCount(toPortalActor(user));
      }),
    Schema.Number,
    { preview: true }
  );

export const getPortalApproval = async (input: unknown) =>
  await runPortalAction(
    input,
    PortalApprovalIdInputSchema,
    (user, validated) =>
      Effect.gen(function* getPortalApprovalProgram() {
        const approvals = yield* PortalApprovals;
        return yield* approvals.get(toPortalActor(user), validated.approvalId);
      }),
    PortalApprovalDetailSchema,
    { preview: true }
  );

// Keyed by id so page metadata and the page body share one fetch per request.
export const getPortalApprovalById = cache(
  async (approvalId: string) => await getPortalApproval({ approvalId })
);

// Another company's request reads as missing so its existence is never
// confirmed.
export const getPortalApprovalRecord = async (approvalId: string) =>
  readRecordOrNotFound(
    await getPortalApprovalById(approvalId),
    "This approval",
    HIDDEN_RECORD_CODES
  );
