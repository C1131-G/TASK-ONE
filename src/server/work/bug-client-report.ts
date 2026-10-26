import { loadSlaSettings } from "../company/sla-settings";
import { buildSlaView } from "./bug-sla";
import type { Transaction } from "./work-internal";

const CAN_ASK_CLIENT_STATUSES = new Set([
  "triaged",
  "in_progress",
  "in_verification",
]);
const CAN_CLOSE_NOT_A_BUG_STATUSES = new Set([
  "reported",
  "triaged",
  "in_progress",
  "needs_info",
]);

const canWorkInStatus = (
  canWork: boolean,
  status: string,
  allowedStatuses: ReadonlySet<string>
) => canWork && allowedStatuses.has(status);

// What a staff member may do with a client bug. The staff bug context and the
// mobile bug list both answer from here, so they never disagree.
export const clientBugPermissions = (facts: {
  readonly companyIsActive: boolean;
  readonly isAssigned: boolean;
  readonly isHandler: boolean;
  readonly pickedById: string | null;
  readonly role: string;
  readonly status: string;
}) => {
  const canWork = facts.role === "admin" || facts.isAssigned;
  return {
    canAskClient: canWorkInStatus(
      canWork,
      facts.status,
      CAN_ASK_CLIENT_STATUSES
    ),
    canCloseNotABug: canWorkInStatus(
      canWork,
      facts.status,
      CAN_CLOSE_NOT_A_BUG_STATUSES
    ),
    canPick:
      facts.status === "reported" &&
      facts.pickedById === null &&
      facts.isHandler &&
      facts.companyIsActive,
    canWork,
  };
};

const optionalRecord = <Record>(
  enabled: boolean,
  query: () => Promise<Record | null>
) => (enabled ? query() : Promise.resolve(null));

// The client-report facts the team sees on a bug: where it came from, who
// picked it up, and whether the viewer can pick it.
export const loadClientReport = async (
  transaction: Transaction,
  actor: { readonly id: string; readonly role: string },
  bug: {
    readonly id: string;
    readonly awaitingClientSince: Date | null;
    readonly clientCompanyId: string | null;
    readonly clientReopenCount: number;
    readonly needsInfoSince: Date | null;
    readonly pickedAt: Date | null;
    readonly pickedById: string | null;
    readonly resolution: string | null;
    readonly satisfaction: "up" | "down" | null;
    readonly satisfactionComment: string | null;
    readonly status: string;
    readonly taskId: string;
  }
) => {
  if (!bug.clientCompanyId) {
    return null;
  }
  const companyId = bug.clientCompanyId;
  const [company, picker, handler, assignment, sla, settings] =
    await Promise.all([
      transaction.orm.public.ClientCompany.where({ id: companyId })
        .select("name", "deactivatedAt")
        .first(),
      optionalRecord(Boolean(bug.pickedById), () =>
        transaction.orm.public.User.where({ id: bug.pickedById ?? "" })
          .select("name")
          .first()
      ),
      optionalRecord(actor.role === "employee", () =>
        transaction.orm.public.ClientCompanyHandler.where({
          companyId,
          employeeId: actor.id,
        })
          .select("id")
          .first()
      ),
      optionalRecord(actor.role === "employee", () =>
        transaction.orm.public.TaskAssignee.where({
          taskId: bug.taskId,
          userId: actor.id,
        })
          .select("userId")
          .first()
      ),
      transaction.orm.public.BugSla.where({ bugId: bug.id }).first(),
      loadSlaSettings(transaction),
    ]);
  const permissions = clientBugPermissions({
    companyIsActive: company?.deactivatedAt === null,
    isAssigned: Boolean(assignment),
    isHandler: Boolean(handler),
    pickedById: bug.pickedById,
    role: actor.role,
    status: bug.status,
  });
  return {
    awaitingClientSince: bug.awaitingClientSince?.toISOString() ?? null,
    canAskClient: permissions.canAskClient,
    canCloseNotABug: permissions.canCloseNotABug,
    canPick: permissions.canPick,
    companyId,
    companyName: company?.name ?? "Unknown company",
    needsInfoSince: bug.needsInfoSince?.toISOString() ?? null,
    pickedAt: bug.pickedAt?.toISOString() ?? null,
    pickedByName: picker?.name ?? null,
    reopenCount: bug.clientReopenCount,
    resolution: bug.resolution,
    satisfaction: bug.satisfaction,
    satisfactionComment: bug.satisfactionComment,
    sla: sla ? buildSlaView(sla, settings, new Date()) : null,
  };
};
