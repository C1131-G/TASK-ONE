import { randomUUID } from "node:crypto";

import { Schema } from "effect";

import type { BugRelationInput, BugTriageInput } from "./bug-contracts";
import { BugRelationInputSchema, BugTriageInputSchema } from "./bug-contracts";
import { hasRelationPath } from "./bug-relation-path";
import { markFirstResponse } from "./bug-sla";
import { transitionBugStatus } from "./bug-workflow";
import {
  decodeBugWorkflowStatus,
  assertBugEditor,
  assertWritable,
  conflict,
  forbidden,
  loadBug,
  required,
  updateBugStatus,
  workspaceActor,
  writeActivity,
} from "./bug-workflow-internal";
import type { BugWorkflowReceipt } from "./bug-workflow-internal";
import type { Transaction } from "./work-internal";
import { notifyTaskAssignees } from "./work-notifications";

export interface TriageDecision {
  readonly assigneeIds: readonly string[];
  readonly priority: BugTriageInput["priority"];
  readonly severity: BugTriageInput["severity"];
}

// The triage itself, shared by admin triage and a handler picking a client
// bug. It trusts the caller to have checked who may triage.
export const applyTriage = async (
  transaction: Transaction,
  actor: { readonly id: string; readonly name: string },
  context: {
    readonly bug: Awaited<ReturnType<typeof loadBug>>["bug"];
    readonly project: Awaited<ReturnType<typeof loadBug>>["project"];
    readonly task: Awaited<ReturnType<typeof loadBug>>["task"];
  },
  decision: TriageDecision
): Promise<BugWorkflowReceipt> => {
  const { bug, project, task } = context;
  const { assigneeIds } = decision;
  if (bug.status === "reported") {
    transitionBugStatus({
      actorRole: "admin",
      currentStatus: "reported",
      nextStatus: "triaged",
    });
  }
  const assignees = await transaction.orm.public.User.where((user) =>
    user.id.in([...assigneeIds])
  )
    .select("id", "deactivatedAt", "role")
    .all();
  if (
    assignees.length !== new Set(assigneeIds).size ||
    assignees.some(
      ({ deactivatedAt, role }) => deactivatedAt || role !== "employee"
    )
  ) {
    required("Choose active employees for every assignee.");
  }
  const now = new Date();
  await transaction.orm.public.Task.where({ id: task.id }).update({
    priority: decision.priority,
    updatedAt: now,
  });
  await transaction.orm.public.TaskAssignee.where({
    taskId: task.id,
  }).deleteAll();
  await Promise.all(
    assigneeIds.map((userId) =>
      transaction.orm.public.TaskAssignee.create({
        assignedAt: now,
        assignedById: actor.id,
        taskId: task.id,
        userId,
      })
    )
  );
  const result =
    bug.status === "reported"
      ? await updateBugStatus(transaction, {
          actorId: actor.id,
          bug,
          details: {
            assigneeIds,
            priority: decision.priority,
            severity: decision.severity,
          },
          nextStatus: "triaged",
          now,
        })
      : await (async () => {
          const version = bug.version + 1;
          const changed = await transaction.orm.public.BugReport.where({
            id: bug.id,
            version: bug.version,
          }).updateAndCount({
            severity: decision.severity,
            updatedAt: now,
            version,
          });
          if (!changed) {
            conflict();
          }
          await writeActivity(transaction, {
            action: "bug.triaged",
            actorId: actor.id,
            bugId: bug.id,
            details: { assigneeIds, priority: decision.priority },
            now,
            projectId: project.id,
            taskId: task.id,
          });
          return { bugId: bug.id, status: "triaged" as const, version };
        })();
  if (decision.severity !== bug.severity) {
    await transaction.orm.public.BugReport.where({ id: bug.id }).update({
      severity: decision.severity,
    });
  }
  if (bug.clientCompanyId) {
    await markFirstResponse(transaction, bug.id, now);
    // Whoever gets a client bug now owns it: an unpicked report counts as
    // picked by its first assignee, and a reassignment flag is resolved.
    const [firstAssignee] = assigneeIds;
    await transaction.orm.public.BugReport.where({
      id: bug.id,
      pickedById: null,
    }).updateAll(
      firstAssignee
        ? { pickedAt: now, pickedById: firstAssignee }
        : { updatedAt: now }
    );
    if (bug.needsReassignment) {
      await transaction.orm.public.BugReport.where({ id: bug.id }).update({
        needsReassignment: false,
      });
    }
  }
  await notifyTaskAssignees(
    transaction,
    { id: actor.id, name: actor.name },
    { id: task.id, projectId: project.id, title: task.title },
    [...assigneeIds],
    now,
    "assignment",
    `/bugs/${bug.id}`
  );
  return result;
};

export const triageBug = async (
  transaction: Transaction,
  actorId: string,
  rawInput: BugTriageInput
): Promise<BugWorkflowReceipt> => {
  const input = Schema.decodeUnknownSync(BugTriageInputSchema)(rawInput);
  const actor = await workspaceActor(transaction, actorId);
  if (actor.role !== "admin") {
    forbidden("Only admins can triage bug reports.");
  }
  const context = await loadBug(transaction, input.bugId);
  const { bug, project, task } = context;
  assertWritable(bug, task, project);
  if (
    bug.version !== input.expectedVersion ||
    !["reported", "triaged"].includes(bug.status)
  ) {
    conflict();
  }
  return applyTriage(transaction, actor, context, {
    assigneeIds: input.assigneeIds,
    priority: input.priority,
    severity: input.severity,
  });
};

export const addBugRelation = async (
  transaction: Transaction,
  actorId: string,
  rawInput: BugRelationInput
): Promise<BugWorkflowReceipt> => {
  const input = Schema.decodeUnknownSync(BugRelationInputSchema)(rawInput);
  const [actor, source] = await Promise.all([
    workspaceActor(transaction, actorId),
    loadBug(transaction, input.bugId),
  ]);
  if (input.type === "duplicate" && actor.role !== "admin") {
    forbidden("Only admins can mark a bug as a duplicate.");
  }
  if (input.type === "recurrence") {
    await assertBugEditor(transaction, actor, source.bug);
  }
  assertWritable(source.bug, source.task, source.project);
  if (source.bug.version !== input.expectedVersion) {
    conflict();
  }
  const target = await loadBug(transaction, input.relatedBugId);
  if (source.bug.id === target.bug.id) {
    required("A bug report cannot be related to itself.");
  }
  const existing = await transaction.orm.public.BugRelation.where({
    fromBugReportId: source.bug.id,
    toBugReportId: target.bug.id,
    type: input.type,
  }).first();
  if (existing) {
    return {
      bugId: source.bug.id,
      status: decodeBugWorkflowStatus(source.bug.status),
      version: source.bug.version,
    };
  }
  await transaction.orm.public.CompanySettings.upsert({
    conflictOn: { id: "company" },
    create: {
      brandColor: "#1D1C1A",
      brandEnabled: true,
      id: "company",
      name: "Gr8r Studio",
      settings: {},
      slug: "gr8rstudio",
      timeZone: "Asia/Kolkata",
      updatedAt: new Date(),
    },
    update: { updatedAt: new Date() },
  });
  if (
    await hasRelationPath(transaction, target.bug.id, source.bug.id, input.type)
  ) {
    required("This relation would create a cycle in the bug history.");
  }
  const now = new Date();
  await transaction.orm.public.BugRelation.create({
    createdAt: now,
    createdById: actorId,
    fromBugReportId: source.bug.id,
    id: randomUUID(),
    toBugReportId: target.bug.id,
    type: input.type,
  });
  const nextStatus =
    input.type === "duplicate"
      ? "duplicate"
      : decodeBugWorkflowStatus(source.bug.status);
  const result =
    input.type === "duplicate"
      ? await updateBugStatus(transaction, {
          actorId,
          bug: source.bug,
          details: { duplicateOf: target.bug.id },
          nextStatus,
          now,
        })
      : await (async () => {
          const version = source.bug.version + 1;
          const changed = await transaction.orm.public.BugReport.where({
            id: source.bug.id,
            version: source.bug.version,
          }).updateAndCount({ updatedAt: now, version });
          if (!changed) {
            conflict();
          }
          return { bugId: source.bug.id, status: nextStatus, version };
        })();
  await writeActivity(transaction, {
    action:
      input.type === "duplicate"
        ? "bug.duplicate_linked"
        : "bug.recurrence_linked",
    actorId,
    bugId: source.bug.id,
    details: { relatedBugId: target.bug.id, relationType: input.type },
    now,
    projectId: source.project.id,
    taskId: source.task.id,
  });
  return result;
};
