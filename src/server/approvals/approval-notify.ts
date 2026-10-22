import { and } from "@prisma/orm-postgres/orm-client";

import { notifyUsers } from "../notifications/notify-users";
import type { Transaction } from "../work/work-internal";

const SNIPPET_LENGTH = 240;

// Every active person of the company hears about a new request, with a link
// to the portal page and no task reference (the portal lists only bugs by
// task, and a shared task is shown through the request instead).
export const notifyClientsOfRequest = async (
  transaction: Transaction,
  request: {
    readonly actorId: string;
    readonly companyId: string;
    readonly id: string;
    readonly message: string;
    readonly now: Date;
    readonly projectId: string;
    readonly subjectTitle: string;
    readonly version: number;
  }
): Promise<void> => {
  const clients = await transaction.orm.public.User.where((user) =>
    and(
      user.clientCompanyId.eq(request.companyId),
      user.role.eq("client"),
      user.deactivatedAt.isNull()
    )
  )
    .select("id")
    .all();
  await notifyUsers(transaction, {
    actorId: request.actorId,
    now: request.now,
    projectId: request.projectId,
    recipientIds: clients.map(({ id }) => id),
    snippet: request.message.slice(0, SNIPPET_LENGTH),
    taskId: null,
    text:
      request.version > 1
        ? `Approval requested again: ${request.subjectTitle}`
        : `Approval requested: ${request.subjectTitle}`,
    type: "status",
    url: `/portal/approvals/${request.id}`,
  });
};

// The person who asked and the task's creator and assignees hear the outcome.
export const notifyStaffOfDecision = async (
  transaction: Transaction,
  decision: {
    readonly actorId: string;
    readonly actorName: string;
    readonly approved: boolean;
    readonly comment: string | null;
    readonly now: Date;
    readonly projectId: string;
    readonly requestedById: string;
    readonly subjectTitle: string;
    readonly taskId: string | null;
  }
): Promise<void> => {
  const people = new Set([decision.requestedById]);
  if (decision.taskId) {
    const [task, assignees] = await Promise.all([
      transaction.orm.public.Task.where({ id: decision.taskId })
        .select("createdById")
        .first(),
      transaction.orm.public.TaskAssignee.where({ taskId: decision.taskId })
        .select("userId")
        .all(),
    ]);
    if (task) {
      people.add(task.createdById);
    }
    for (const { userId } of assignees) {
      people.add(userId);
    }
  }
  // Only staff are told; a client who created a task never gets staff links.
  const staff = await transaction.orm.public.User.where((user) =>
    and(user.id.in([...people]), user.role.neq("client"))
  )
    .select("id")
    .all();
  await notifyUsers(transaction, {
    actorId: decision.actorId,
    now: decision.now,
    projectId: decision.projectId,
    recipientIds: staff.map(({ id }) => id),
    snippet: decision.comment?.slice(0, SNIPPET_LENGTH) ?? null,
    taskId: decision.taskId,
    text: decision.approved
      ? `${decision.actorName} approved ${decision.subjectTitle}`
      : `${decision.actorName} requested changes to ${decision.subjectTitle}`,
    type: "update",
    url: decision.taskId ? `/tasks/${decision.taskId}` : "/tasks",
  });
};
