import type { Transaction } from "./work-internal";

// The client-report facts the team sees on a bug: where it came from, who
// picked it up, and whether the viewer can pick it.
export const loadClientReport = async (
  transaction: Transaction,
  actor: { readonly id: string; readonly role: string },
  bug: {
    readonly clientCompanyId: string | null;
    readonly clientReopenCount: number;
    readonly pickedAt: Date | null;
    readonly pickedById: string | null;
    readonly status: string;
  }
) => {
  if (!bug.clientCompanyId) {
    return null;
  }
  const companyId = bug.clientCompanyId;
  const [company, picker, handler] = await Promise.all([
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
  ]);
  return {
    canPick:
      bug.status === "reported" &&
      bug.pickedById === null &&
      Boolean(handler) &&
      company?.deactivatedAt === null,
    companyId,
    companyName: company?.name ?? "Unknown company",
    pickedAt: bug.pickedAt?.toISOString() ?? null,
    pickedByName: picker?.name ?? null,
    reopenCount: bug.clientReopenCount,
  };
};
