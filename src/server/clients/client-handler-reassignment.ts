import { and } from "@prisma/orm-postgres/orm-client";

import { activeAdminIds, notifyUsers } from "../notifications/notify-users";
import type { DbTransaction } from "../people/user-internal";

// Client bugs past these statuses no longer need anyone working on them.
export const closedClientBugStatuses = [
  "closed",
  "duplicate",
  "withdrawn",
] as const;

// When a handler leaves a company (or the workspace), the open client bugs
// they were working on are flagged so an admin can reassign them.
export const flagHandlerBugsForReassignment = async (
  transaction: DbTransaction,
  input: {
    readonly actorId: string;
    readonly employeeId: string;
    // Limit to one company's bugs; null covers every company.
    readonly companyId: string | null;
    readonly now: Date;
  }
): Promise<number> => {
  const assignments = await transaction.orm.public.TaskAssignee.where({
    userId: input.employeeId,
  })
    .select("taskId")
    .all();
  const taskIds = assignments.map(({ taskId }) => taskId);
  if (taskIds.length === 0) {
    return 0;
  }
  const bugs = await transaction.orm.public.BugReport.where((bug) =>
    and(
      bug.taskId.in(taskIds),
      bug.clientCompanyId.isNotNull(),
      bug.status.notIn([...closedClientBugStatuses]),
      bug.needsReassignment.eq(false)
    )
  )
    .select("id", "taskId", "projectId", "clientCompanyId")
    .all();
  const flagged = bugs.filter(
    (bug) => input.companyId === null || bug.clientCompanyId === input.companyId
  );
  if (flagged.length === 0) {
    return 0;
  }
  await transaction.orm.public.BugReport.where((bug) =>
    bug.id.in(flagged.map(({ id }) => id))
  ).updateAll({ needsReassignment: true, updatedAt: input.now });
  const [employee, admins] = await Promise.all([
    transaction.orm.public.User.where({ id: input.employeeId })
      .select("name")
      .first(),
    activeAdminIds(transaction),
  ]);
  await Promise.all(
    flagged.map((bug) =>
      notifyUsers(transaction, {
        actorId: input.actorId,
        now: input.now,
        projectId: bug.projectId,
        recipientIds: admins,
        snippet: `${employee?.name ?? "A handler"} can no longer work on it.`,
        taskId: bug.taskId,
        text: "A client bug needs reassignment",
        type: "client_bug",
        url: `/bugs/${bug.id}`,
      })
    )
  );
  return flagged.length;
};
