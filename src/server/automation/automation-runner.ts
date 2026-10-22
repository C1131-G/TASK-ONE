import { randomUUID } from "node:crypto";

import { and } from "@prisma/orm-postgres/orm-client";
import { Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { logger } from "../core/logger";
import { isUniqueConstraintViolation } from "../core/prisma-errors";
import { applyActions } from "./automation-actions";
import type { RunRule, RunTask } from "./automation-actions";
import { StoredRuleBodySchema } from "./automation-contracts";
import { RATE_LIMIT_WINDOW_MS, decideRun } from "./automation-evaluator";
import type { AutomationJobPayload } from "./automation-job";
import type {
  AutomationEvent,
  AutomationRuleDefinition,
  TaskSnapshot,
} from "./automation-model";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const MAX_REASON_LENGTH = 300;

interface RuleRow {
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly trigger: string;
  readonly createdById: string;
  readonly conditions: unknown;
  readonly actions: unknown;
}

interface Loaded {
  readonly task: RunTask;
  readonly snapshot: TaskSnapshot;
}

const loadTask = async (
  transaction: Transaction,
  taskId: string
): Promise<Loaded | null> => {
  const row = await transaction.orm.public.Task.include("project")
    .where({ id: taskId })
    .first();
  if (!row) {
    return null;
  }
  const [assignees, labels, recurrence] = await Promise.all([
    transaction.orm.public.TaskAssignee.where({ taskId })
      .select("userId")
      .all(),
    transaction.orm.public.TaskLabel.where({ taskId }).select("labelId").all(),
    transaction.orm.public.TaskRecurrence.where({ taskId }).first(),
  ]);
  const assigneeIds = assignees.map(({ userId }) => userId);
  const labelIds = labels.map(({ labelId }) => labelId);
  return {
    snapshot: {
      archived: Boolean(row.archivedAt ?? row.project.archivedAt),
      assigneeIds,
      hasRecurrence: Boolean(recurrence),
      labelIds,
      priority: row.priority,
      status: row.status,
      type: row.type,
    },
    task: {
      assigneeIds,
      completedAt: row.completedAt,
      dueDate: row.dueDate,
      id: row.id,
      labelIds,
      priority: row.priority,
      projectId: row.projectId,
      projectTaskNumber: row.projectTaskNumber,
      status: row.status,
      title: row.title,
      version: row.version,
    },
  };
};

const decodeBody = (
  rule: RuleRow
): Pick<AutomationRuleDefinition, "actions" | "conditions"> | null => {
  try {
    return Schema.decodeUnknownSync(StoredRuleBodySchema)({
      actions: rule.actions,
      conditions: rule.conditions,
    });
  } catch {
    return null;
  }
};

const recentRunCount = async (
  transaction: Transaction,
  ruleId: string,
  taskId: string,
  now: Date
): Promise<number> => {
  const since = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);
  const runs = await transaction.orm.public.AutomationRun.where((run) =>
    and(
      run.ruleId.eq(ruleId),
      run.taskId.eq(taskId),
      run.createdAt.gte(since),
      run.outcome.neq("skipped")
    )
  )
    .select("id")
    .all();
  return runs.length;
};

interface LogEntry {
  readonly outcome: "matched" | "skipped" | "failed";
  readonly reason?: string;
}

const logRun = (
  transaction: Transaction,
  payload: AutomationJobPayload,
  ruleId: string,
  entry: LogEntry,
  now: Date
) =>
  transaction.orm.public.AutomationRun.create({
    createdAt: now,
    depth: payload.depth,
    eventId: payload.eventId,
    id: randomUUID(),
    outcome: entry.outcome,
    projectId: payload.projectId,
    reason: entry.reason?.slice(0, MAX_REASON_LENGTH) ?? null,
    ruleId,
    taskId: payload.taskId,
    trigger: payload.trigger,
  });

const processRule = async (
  transaction: Transaction,
  rule: RuleRow,
  payload: AutomationJobPayload,
  now: Date
): Promise<void> => {
  const existing = await transaction.orm.public.AutomationRun.where({
    eventId: payload.eventId,
    ruleId: rule.id,
  })
    .select("id")
    .first();
  if (existing) {
    return;
  }
  const loaded = await loadTask(transaction, payload.taskId);
  if (!loaded) {
    await logRun(
      transaction,
      payload,
      rule.id,
      { outcome: "skipped", reason: "task_missing" },
      now
    );
    return;
  }
  const body = decodeBody(rule);
  if (!body) {
    await logRun(
      transaction,
      payload,
      rule.id,
      { outcome: "failed", reason: "The stored rule is no longer valid." },
      now
    );
    return;
  }
  const definition: AutomationRuleDefinition = {
    ...body,
    enabled: rule.enabled,
    id: rule.id,
    trigger: payload.trigger,
  };
  const event: AutomationEvent = {
    causedByRuleId: payload.causedByRuleId,
    depth: payload.depth,
    eventId: payload.eventId,
    trigger: payload.trigger,
  };
  const decision = decideRun({
    event,
    recentRuns: await recentRunCount(transaction, rule.id, payload.taskId, now),
    rule: definition,
    task: loaded.snapshot,
  });
  if (decision.outcome === "not_applicable") {
    return;
  }
  if (decision.outcome === "skipped") {
    await logRun(transaction, payload, rule.id, decision, now);
    return;
  }
  const runRule: RunRule = {
    createdById: rule.createdById,
    id: rule.id,
    name: rule.name,
  };
  await applyActions(
    {
      eventDepth: payload.depth,
      now,
      rule: runRule,
      task: loaded.task,
      transaction,
    },
    body.actions
  );
  await logRun(transaction, payload, rule.id, { outcome: "matched" }, now);
};

const recordFailure = async (
  payload: AutomationJobPayload,
  ruleId: string,
  reason: string,
  now: Date
): Promise<void> => {
  try {
    await db.transaction((transaction) =>
      logRun(transaction, payload, ruleId, { outcome: "failed", reason }, now)
    );
  } catch (error) {
    // Another worker already logged this (rule, event); nothing to add.
    if (!isUniqueConstraintViolation(error)) {
      throw error;
    }
  }
};

/**
 * Runs every enabled rule of the task's project that listens to the event.
 * Each rule runs in its own transaction together with its run-log row, so its
 * actions apply exactly once per (rule, event) and a failing rule leaves no
 * partial changes and never blocks the others. A rule that cannot do what it
 * says is logged as failed; infrastructure errors propagate so the job is
 * retried.
 */
export const runAutomationEvent = async (
  payload: AutomationJobPayload,
  now: Date = new Date()
): Promise<void> => {
  const rules = await db.orm.public.AutomationRule.where({
    enabled: true,
    projectId: payload.projectId,
    trigger: payload.trigger,
  }).all();
  let retry: unknown = null;
  for (const rule of rules) {
    try {
      // Rules are independent but ordered by creation for a stable log.
      // eslint-disable-next-line no-await-in-loop
      await db.transaction((transaction) =>
        processRule(transaction, rule, payload, now)
      );
    } catch (error) {
      if (error instanceof AppError && error.code === "VALIDATION_FAILED") {
        // eslint-disable-next-line no-await-in-loop
        await recordFailure(payload, rule.id, error.message, now);
      } else if (isUniqueConstraintViolation(error)) {
        // A concurrent worker finished this (rule, event) first.
      } else {
        logger.error("An automation rule could not run.", {
          error,
          ruleId: rule.id,
        });
        retry = error;
      }
    }
  }
  if (retry !== null) {
    throw retry;
  }
};
