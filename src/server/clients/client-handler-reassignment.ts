import { and } from "@prisma/orm-postgres/orm-client";

import { activeAdminIds, notifyUsers } from "../notifications/notify-users";
import type { DbTransaction } from "../people/user-internal";

// Client bugs past these statuses no longer need anyone working on them.
export const closedClientBugStatuses = [
  "closed",
  "duplicate",
  "withdrawn",
] as const;

// Names the departing handler on each task: the first listed employee who
// was assigned to it.
const departingNameByTask = async (
  transaction: DbTransaction,
  employeeIds: readonly string[],
  assignments: readonly { readonly taskId: string; readonly userId: string }[]
): Promise<Map<string, string>> => {
  const employees = await transaction.orm.public.User.where((user) =>
    user.id.in([...employeeIds])
  )
    .select("id", "name")
    .all();
  const nameById = new Map(employees.map(({ id, name }) => [id, name]));
  const rank = new Map(employeeIds.map((id, index) => [id, index]));
  const names = new Map<string, string>();
  const byRank = assignments.toSorted(
    (left, right) =>
      (rank.get(left.userId) ?? 0) - (rank.get(right.userId) ?? 0)
  );
  for (const { taskId, userId } of byRank) {
    const name = nameById.get(userId);
    if (name && !names.has(taskId)) {
      names.set(taskId, name);
    }
  }
  return names;
};

// When handlers leave a company (or the workspace), the open client bugs
// they were working on are flagged once so an admin can reassign them.
export const flagHandlerBugsForReassignment = async (
  transaction: DbTransaction,
  input: {
    readonly actorId: string;
    readonly employeeIds: readonly string[];
    // Limit to one company's bugs; null covers every company.
    readonly companyId: string | null;
    readonly now: Date;
  }
): Promise<number> => {
  if (input.employeeIds.length === 0) {
    return 0;
  }
  const assignments = await transaction.orm.public.TaskAssignee.where(
    (assignee) => assignee.userId.in([...input.employeeIds])
  )
    .select("taskId", "userId")
    .all();
  const taskIds = [...new Set(assignments.map(({ taskId }) => taskId))];
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
  const [names, admins] = await Promise.all([
    departingNameByTask(transaction, input.employeeIds, assignments),
    activeAdminIds(transaction),
  ]);
  await Promise.all(
    flagged.map((bug) =>
      notifyUsers(transaction, {
        actorId: input.actorId,
        now: input.now,
        projectId: bug.projectId,
        recipientIds: admins,
        snippet: `${names.get(bug.taskId) ?? "A handler"} can no longer work on it.`,
        taskId: bug.taskId,
        text: "A client bug needs reassignment",
        type: "client_bug",
        url: `/bugs/${bug.id}`,
      })
    )
  );
  return flagged.length;
};
