import { loadSlaSettings } from "../company/sla-settings";
import { buildSlaView } from "./bug-sla";
import type { Transaction } from "./work-internal";

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
      bug.pickedById
        ? transaction.orm.public.User.where({ id: bug.pickedById })
            .select("name")
            .first()
        : null,
      actor.role === "employee"
        ? transaction.orm.public.ClientCompanyHandler.where({
            companyId,
            employeeId: actor.id,
          })
            .select("id")
            .first()
        : null,
      actor.role === "employee"
        ? transaction.orm.public.TaskAssignee.where({
            taskId: bug.taskId,
            userId: actor.id,
          })
            .select("userId")
            .first()
        : null,
      transaction.orm.public.BugSla.where({ bugId: bug.id }).first(),
      loadSlaSettings(transaction),
    ]);
  const canWork = actor.role === "admin" || Boolean(assignment);
  return {
    awaitingClientSince: bug.awaitingClientSince?.toISOString() ?? null,
    canAskClient:
      canWork &&
      ["triaged", "in_progress", "in_verification"].includes(bug.status),
    canCloseNotABug:
      canWork &&
      ["reported", "triaged", "in_progress", "needs_info"].includes(bug.status),
    canPick:
      bug.status === "reported" &&
      bug.pickedById === null &&
      Boolean(handler) &&
      company?.deactivatedAt === null,
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
