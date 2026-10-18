import { Schema } from "effect";

import { notifyUsers } from "../notifications/notify-users";
import type { BugReassignInput } from "./bug-contracts";
import { BugReassignInputSchema } from "./bug-contracts";
import {
  decodeBugWorkflowStatus,
  conflict,
  forbidden,
  loadBug,
  required,
  workspaceActor,
  writeActivity,
} from "./bug-workflow-internal";
import type { BugWorkflowReceipt } from "./bug-workflow-internal";
import { CLOSED_STATUSES, bugKey } from "./bug-workflow-pick";
import type { Transaction } from "./work-internal";

// Only an admin moves a picked client bug to someone else, and that someone
// need not be a handler of the company.
export const reassignClientBug = async (
  transaction: Transaction,
  actorId: string,
  rawInput: BugReassignInput
): Promise<BugWorkflowReceipt> => {
  const input = Schema.decodeUnknownSync(BugReassignInputSchema)(rawInput);
  const actor = await workspaceActor(transaction, actorId);
  if (actor.role !== "admin") {
    forbidden("Only admins can reassign client bugs.");
  }
  const { bug, project, task } = await loadBug(transaction, input.bugId);
  if (!bug.clientCompanyId) {
    forbidden("Only client reports can be reassigned here.");
  }
  if (!bug.pickedById) {
    forbidden("Assign an unpicked client bug from the triage form.");
  }
  if (
    CLOSED_STATUSES.has(bug.status) ||
    task.archivedAt ||
    project.archivedAt
  ) {
    forbidden("Closed or archived bugs cannot be reassigned.");
  }
  if (bug.version !== input.expectedVersion) {
    conflict();
  }
  const employee = await transaction.orm.public.User.where({
    id: input.employeeId,
  })
    .select("id", "name", "role", "deactivatedAt")
    .first();
  if (!employee || employee.deactivatedAt || employee.role !== "employee") {
    required("Choose an active employee.");
  }
  const previous = await transaction.orm.public.TaskAssignee.where({
    taskId: task.id,
  })
    .select("userId")
    .all();
  const previousIds = previous.map(({ userId }) => userId);
  const now = new Date();
  const version = bug.version + 1;
  const updated = await transaction.orm.public.BugReport.where({
    id: bug.id,
    version: bug.version,
  }).updateAndCount({
    needsReassignment: false,
    // The new assignee now owns the bug, so "Picked by" names them.
    pickedById: input.employeeId,
    updatedAt: now,
    version,
  });
  if (!updated) {
    conflict();
  }
  await transaction.orm.public.TaskAssignee.where({
    taskId: task.id,
  }).deleteAll();
  await transaction.orm.public.TaskAssignee.create({
    assignedAt: now,
    assignedById: actorId,
    taskId: task.id,
    userId: input.employeeId,
  });
  await writeActivity(transaction, {
    action: "bug.reassigned",
    actorId,
    bugId: bug.id,
    details: { from: previousIds, to: input.employeeId },
    now,
    projectId: project.id,
    taskId: task.id,
  });
  const key = bugKey(project, task);
  await notifyUsers(transaction, {
    actorId,
    now,
    projectId: project.id,
    recipientIds: previousIds.filter((id) => id !== input.employeeId),
    snippet: task.title,
    taskId: task.id,
    text: `${key} was reassigned to ${employee?.name ?? "someone else"}`,
    type: "update",
    url: `/bugs/${bug.id}`,
  });
  await notifyUsers(transaction, {
    actorId,
    now,
    projectId: project.id,
    recipientIds: [input.employeeId],
    snippet: task.title,
    taskId: task.id,
    text: `${actor.name} assigned you ${key}`,
    type: "assignment",
    url: `/bugs/${bug.id}`,
  });
  return {
    bugId: bug.id,
    status: decodeBugWorkflowStatus(bug.status),
    version,
  };
};
