import { randomUUID } from "node:crypto";

import type { db } from "@/src/prisma/db";

import { AUTOMATION_RULE_JOB } from "./automation-contracts";
import type { AutomationJobPayload } from "./automation-job";
import type { AutomationTrigger } from "./automation-model";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const MAX_ATTEMPTS = 5;

export interface RaisedEvent {
  readonly taskId: string;
  readonly projectId: string;
  readonly trigger: AutomationTrigger;
  readonly now: Date;
  readonly depth?: number;
  readonly causedByRuleId?: string;
  readonly eventId?: string;
}

/**
 * Queues one durable job for an event, in the originating transaction: the
 * job exists only if that write commits, and rules run later in the worker,
 * never inside or against the write. Nothing is queued unless the project has
 * an enabled rule for the trigger, so projects without automation pay one
 * indexed read.
 */
export const enqueueAutomationEvent = async (
  transaction: Transaction,
  event: RaisedEvent
): Promise<boolean> => {
  const rule = await transaction.orm.public.AutomationRule.where({
    enabled: true,
    projectId: event.projectId,
    trigger: event.trigger,
  })
    .select("id")
    .first();
  if (!rule) {
    return false;
  }
  const eventId = event.eventId ?? randomUUID();
  const dedupeKey = `automation:${event.trigger}:${eventId}`;
  // A caller-chosen event id (the overdue sweep) can be raised again.
  if (event.eventId) {
    const queued = await transaction.orm.public.Job.where({ dedupeKey })
      .select("id")
      .first();
    if (queued) {
      return false;
    }
  }
  const payload: AutomationJobPayload = {
    causedByRuleId: event.causedByRuleId ?? null,
    depth: event.depth ?? 0,
    eventId,
    projectId: event.projectId,
    taskId: event.taskId,
    trigger: event.trigger,
  };
  await transaction.orm.public.Job.create({
    availableAt: event.now,
    createdAt: event.now,
    dedupeKey,
    id: randomUUID(),
    kind: AUTOMATION_RULE_JOB,
    maxAttempts: MAX_ATTEMPTS,
    payload: { ...payload },
    updatedAt: event.now,
  });
  return true;
};

export interface TaskFieldState {
  readonly status: string;
  readonly priority: string;
  readonly assigneeIds: readonly string[];
}

/** Raises one event per field a person changed between two task states. */
export const enqueueTaskFieldEvents = async (
  transaction: Transaction,
  change: {
    readonly taskId: string;
    readonly projectId: string;
    readonly before: TaskFieldState;
    readonly after: TaskFieldState;
    readonly now: Date;
  }
): Promise<void> => {
  const { after, before, ...target } = change;
  const afterAssignees = new Set(after.assigneeIds);
  const sameAssignees =
    before.assigneeIds.length === afterAssignees.size &&
    before.assigneeIds.every((userId) => afterAssignees.has(userId));
  const triggers: AutomationTrigger[] = [];
  if (before.status !== after.status) {
    triggers.push("status_changed");
  }
  if (before.priority !== after.priority) {
    triggers.push("priority_changed");
  }
  if (!sameAssignees) {
    triggers.push("assignee_changed");
  }
  await Promise.all(
    triggers.map((trigger) =>
      enqueueAutomationEvent(transaction, { ...target, trigger })
    )
  );
};
