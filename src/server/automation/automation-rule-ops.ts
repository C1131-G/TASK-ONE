import { randomUUID } from "node:crypto";

import { Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { requireAdmin } from "../webhooks/webhook-internal";
import {
  AutomationRuleInputSchema,
  MAX_RULES_PER_PROJECT,
  StoredRuleBodySchema,
  AUTOMATION_OUTCOMES,
} from "./automation-contracts";
import type {
  AutomationOutcome,
  AutomationRuleInput,
  AutomationRuleSummary,
  AutomationRunSummary,
} from "./automation-contracts";
import { AUTOMATION_TRIGGERS } from "./automation-model";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const MAX_RUN_PAGE = 100;

const invalid = (message: string, field?: string): AppError =>
  new AppError({
    code: "VALIDATION_FAILED",
    message,
    ...(field ? { field } : {}),
  });

const notFound = (): AppError =>
  new AppError({
    code: "NOT_FOUND",
    message: "That automation was not found.",
  });

const decodeInput = (input: unknown): AutomationRuleInput => {
  try {
    return Schema.decodeUnknownSync(AutomationRuleInputSchema)(input);
  } catch {
    throw invalid("Check the automation and try again.");
  }
};

interface References {
  readonly activeStaff: ReadonlySet<string>;
  readonly anyStaff: ReadonlySet<string>;
  readonly labels: ReadonlySet<string>;
}

const loadReferences = async (
  transaction: Transaction,
  input: AutomationRuleInput
): Promise<References> => {
  const userIds = new Set<string>();
  const labelIds = new Set<string>();
  for (const action of input.actions) {
    if (
      action.type === "assign" ||
      action.type === "unassign" ||
      action.type === "notify"
    ) {
      userIds.add(action.userId);
    }
    if (action.type === "add_label") {
      labelIds.add(action.labelId);
    }
  }
  for (const condition of input.conditions) {
    const target = condition.field === "assignee" ? userIds : labelIds;
    if (condition.field === "assignee" || condition.field === "label") {
      for (const value of condition.values) {
        target.add(value);
      }
    }
  }
  const [users, labels] = await Promise.all([
    transaction.orm.public.User.where((user) => user.id.in([...userIds]))
      .select("id", "role", "deactivatedAt")
      .all(),
    transaction.orm.public.Label.where((label) => label.id.in([...labelIds]))
      .select("id")
      .all(),
  ]);
  const activeStaff = new Set<string>();
  const anyStaff = new Set<string>();
  for (const { deactivatedAt, id, role } of users) {
    if (role !== "client") {
      anyStaff.add(id);
      if (!deactivatedAt) {
        activeStaff.add(id);
      }
    }
  }
  return {
    activeStaff,
    anyStaff,
    labels: new Set(labels.map(({ id }) => id)),
  };
};

// People and labels must exist now; the runner checks again when it runs.
const assertReferences = (
  input: AutomationRuleInput,
  references: References
): void => {
  for (const action of input.actions) {
    switch (action.type) {
      case "assign":
      case "notify": {
        if (!references.activeStaff.has(action.userId)) {
          throw invalid("Choose an active team member.", "actions");
        }
        break;
      }
      case "unassign": {
        if (!references.anyStaff.has(action.userId)) {
          throw invalid("Choose a team member.", "actions");
        }
        break;
      }
      case "add_label": {
        if (!references.labels.has(action.labelId)) {
          throw invalid("Choose an existing label.", "actions");
        }
        break;
      }
      default: {
        break;
      }
    }
  }
  for (const condition of input.conditions) {
    const known =
      condition.field === "assignee" ? references.anyStaff : references.labels;
    const checked =
      condition.field === "assignee" || condition.field === "label";
    if (checked && !condition.values.every((value) => known.has(value))) {
      throw invalid(
        condition.field === "assignee"
          ? "Choose team members for the assignee condition."
          : "Choose existing labels for the label condition.",
        "conditions"
      );
    }
  }
};

interface RuleRow {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly trigger: string;
  readonly conditions: unknown;
  readonly actions: unknown;
  readonly enabled: boolean;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

const triggerOf = (value: string) => {
  const trigger = AUTOMATION_TRIGGERS.find((candidate) => candidate === value);
  if (!trigger) {
    throw new AppError({
      code: "UNAVAILABLE",
      message: "An automation has an unknown trigger.",
    });
  }
  return trigger;
};

const toSummary = (row: RuleRow): AutomationRuleSummary => {
  const body = Schema.decodeUnknownSync(StoredRuleBodySchema)({
    actions: row.actions,
    conditions: row.conditions,
  });
  return {
    actions: body.actions,
    conditions: body.conditions,
    createdAt: row.createdAt.toISOString(),
    enabled: row.enabled,
    id: row.id,
    name: row.name.trim(),
    projectId: row.projectId,
    trigger: triggerOf(row.trigger),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
};

const recordActivity = (
  transaction: Transaction,
  actorId: string,
  action: string,
  rule: { readonly id: string; readonly projectId: string }
) =>
  transaction.orm.public.Activity.create({
    action: `automation_rule.${action}`,
    actorId,
    createdAt: new Date(),
    details: { ruleId: rule.id },
    id: randomUUID(),
    projectId: rule.projectId,
    taskId: null,
  });

const requireRule = async (transaction: Transaction, ruleId: string) => {
  const rule = await transaction.orm.public.AutomationRule.where({
    id: ruleId,
  }).first();
  if (!rule) {
    throw notFound();
  }
  return rule;
};

export const listRules = async (
  actorId: string,
  projectId: string
): Promise<readonly AutomationRuleSummary[]> => {
  await requireAdmin(actorId);
  const rows = await db.orm.public.AutomationRule.where({ projectId })
    .orderBy((rule) => rule.createdAt.asc())
    .all();
  return rows.map(toSummary);
};

export const createRule = async (
  actorId: string,
  projectId: string,
  rawInput: AutomationRuleInput
): Promise<AutomationRuleSummary> => {
  await requireAdmin(actorId);
  const input = decodeInput(rawInput);
  return db.transaction(async (transaction) => {
    const project = await transaction.orm.public.Project.where({
      id: projectId,
    })
      .select("id", "archivedAt")
      .first();
    if (!project) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "The project was not found.",
      });
    }
    if (project.archivedAt) {
      throw new AppError({
        code: "FORBIDDEN",
        message: "Archived projects are read only.",
      });
    }
    const existing = await transaction.orm.public.AutomationRule.where({
      projectId,
    })
      .select("id")
      .all();
    if (existing.length >= MAX_RULES_PER_PROJECT) {
      throw invalid(
        `A project can have at most ${MAX_RULES_PER_PROJECT} automations.`
      );
    }
    assertReferences(input, await loadReferences(transaction, input));
    const now = new Date();
    const created = await transaction.orm.public.AutomationRule.create({
      actions: [...input.actions],
      conditions: [...input.conditions],
      createdAt: now,
      createdById: actorId,
      enabled: true,
      id: randomUUID(),
      name: input.name.trim(),
      projectId,
      trigger: input.trigger,
      updatedAt: now,
      version: 1,
    });
    await recordActivity(transaction, actorId, "created", created);
    return toSummary(created);
  });
};

export const updateRule = async (
  actorId: string,
  ruleId: string,
  expectedVersion: number,
  rawInput: AutomationRuleInput
): Promise<AutomationRuleSummary> => {
  await requireAdmin(actorId);
  const input = decodeInput(rawInput);
  return db.transaction(async (transaction) => {
    const current = await requireRule(transaction, ruleId);
    assertReferences(input, await loadReferences(transaction, input));
    const updated = await transaction.orm.public.AutomationRule.where({
      id: ruleId,
      version: expectedVersion,
    }).updateAndCount({
      actions: [...input.actions],
      conditions: [...input.conditions],
      name: input.name.trim(),
      trigger: input.trigger,
      updatedAt: new Date(),
      version: expectedVersion + 1,
    });
    if (!updated) {
      throw new AppError({
        code: "CONFLICT",
        message: "The automation changed. Refresh and try again.",
      });
    }
    await recordActivity(transaction, actorId, "updated", current);
    return toSummary(await requireRule(transaction, ruleId));
  });
};

export const setRuleEnabled = async (
  actorId: string,
  ruleId: string,
  enabled: boolean
): Promise<AutomationRuleSummary> => {
  await requireAdmin(actorId);
  return db.transaction(async (transaction) => {
    const current = await requireRule(transaction, ruleId);
    await transaction.orm.public.AutomationRule.where({ id: ruleId }).update({
      enabled,
      updatedAt: new Date(),
      version: current.version + 1,
    });
    await recordActivity(
      transaction,
      actorId,
      enabled ? "enabled" : "disabled",
      current
    );
    return toSummary(await requireRule(transaction, ruleId));
  });
};

export const removeRule = async (
  actorId: string,
  ruleId: string
): Promise<void> => {
  await requireAdmin(actorId);
  await db.transaction(async (transaction) => {
    const current = await requireRule(transaction, ruleId);
    await transaction.orm.public.AutomationRule.where({
      id: ruleId,
    }).deleteAll();
    await recordActivity(transaction, actorId, "removed", current);
  });
};

const outcomeOf = (value: string): AutomationOutcome =>
  AUTOMATION_OUTCOMES.find((outcome) => outcome === value) ?? "failed";

export const listRuns = async (
  actorId: string,
  projectId: string,
  requestedLimit: number
): Promise<readonly AutomationRunSummary[]> => {
  await requireAdmin(actorId);
  const limit = Math.min(
    MAX_RUN_PAGE,
    Math.max(
      1,
      Number.isFinite(requestedLimit) ? Math.trunc(requestedLimit) : 1
    )
  );
  const runs = await db.orm.public.AutomationRun.where({ projectId })
    .orderBy((run) => run.createdAt.desc())
    .limit(limit)
    .all();
  if (runs.length === 0) {
    return [];
  }
  const ruleIds = [...new Set(runs.map(({ ruleId }) => ruleId))];
  const taskIds = [
    ...new Set(runs.flatMap(({ taskId }) => (taskId === null ? [] : [taskId]))),
  ];
  const [rules, tasks, project] = await Promise.all([
    db.orm.public.AutomationRule.where((rule) => rule.id.in(ruleIds))
      .select("id", "name")
      .all(),
    db.orm.public.Task.where((task) => task.id.in(taskIds))
      .select("id", "projectTaskNumber")
      .all(),
    db.orm.public.Project.where({ id: projectId }).select("key").first(),
  ]);
  const ruleNames = new Map(rules.map(({ id, name }) => [id, name]));
  const taskNumbers = new Map(
    tasks.map(({ id, projectTaskNumber }) => [id, projectTaskNumber])
  );
  return runs.map((run) => {
    const number =
      run.taskId === null ? undefined : taskNumbers.get(run.taskId);
    return {
      createdAt: run.createdAt.toISOString(),
      depth: run.depth,
      id: run.id,
      outcome: outcomeOf(run.outcome),
      reason: run.reason,
      ruleId: run.ruleId,
      ruleName: ruleNames.get(run.ruleId) ?? "Removed automation",
      taskId: run.taskId,
      taskKey:
        project && number !== undefined ? `${project.key}-${number}` : null,
      trigger: run.trigger,
    };
  });
};
