import { randomUUID } from "node:crypto";

import type { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { notifyUsers } from "../notifications/notify-users";
import { enqueueWebhookEvent } from "../webhooks/webhook-enqueue";
import { enqueueTaskChange } from "../webhooks/webhook-task-event";
import { enqueueAutomationEvent } from "./automation-enqueue";
import { eventsCausedBy } from "./automation-evaluator";
import type { FieldChanges } from "./automation-evaluator";
import type {
  AutomationAction,
  AutomationTaskPriority,
  AutomationTaskStatus,
} from "./automation-model";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface RunTask {
  readonly id: string;
  readonly projectId: string;
  readonly projectTaskNumber: number;
  readonly title: string;
  readonly status: AutomationTaskStatus;
  readonly priority: AutomationTaskPriority;
  readonly dueDate: string | null;
  readonly completedAt: Date | null;
  readonly version: number;
  readonly assigneeIds: readonly string[];
  readonly labelIds: readonly string[];
}

export interface RunRule {
  readonly id: string;
  readonly name: string;
  // Automation writes carry this person's id (the schema needs a real user)
  // but are marked as automation in the activity log and in comment text.
  readonly createdById: string;
}

export interface ActionRun {
  readonly transaction: Transaction;
  readonly rule: RunRule;
  readonly task: RunTask;
  // The depth of the event that triggered the rule.
  readonly eventDepth: number;
  readonly now: Date;
}

// Raised for a rule that cannot do what it says (an unavailable person, a
// missing label). The run is logged as failed and the job is not retried.
const unavailable = (action: AutomationAction, message: string): AppError =>
  new AppError({
    code: "VALIDATION_FAILED",
    message: `${action.type}: ${message}`,
  });

const requireStaff = async (
  transaction: Transaction,
  action: AutomationAction,
  userId: string
): Promise<void> => {
  const person = await transaction.orm.public.User.where({ id: userId })
    .select("role", "deactivatedAt")
    .first();
  if (!person || person.deactivatedAt || person.role === "client") {
    throw unavailable(action, "that person is not an active team member");
  }
};

interface MutableState {
  status: AutomationTaskStatus;
  priority: AutomationTaskPriority;
  version: number;
  completedAt: Date | null;
  assigneeIds: string[];
  labelIds: string[];
  statusChanged: boolean;
  priorityChanged: boolean;
  assigneesChanged: boolean;
}

const recordActivity = (
  run: ActionRun,
  action: string,
  details: Record<string, string | number | boolean>
) =>
  run.transaction.orm.public.Activity.create({
    action: `automation.${action}`,
    actorId: run.rule.createdById,
    createdAt: run.now,
    details: {
      ...details,
      automation: true,
      depth: run.eventDepth + 1,
      ruleId: run.rule.id,
    },
    id: randomUUID(),
    projectId: run.task.projectId,
    taskId: run.task.id,
  });

const writeTask = async (
  run: ActionRun,
  state: MutableState,
  changes:
    | {
        readonly status: AutomationTaskStatus;
        readonly completedAt: Date | null;
      }
    | { readonly priority: AutomationTaskPriority }
): Promise<void> => {
  const updated = await run.transaction.orm.public.Task.where({
    id: run.task.id,
    version: state.version,
  }).updateAndCount({
    ...changes,
    updatedAt: run.now,
    version: state.version + 1,
  });
  if (!updated) {
    // A person edited the task since the run started; the job is retried.
    throw new AppError({
      code: "CONFLICT",
      message: "The task changed during the automation run.",
    });
  }
  state.version += 1;
};

const setStatus = async (
  run: ActionRun,
  state: MutableState,
  status: AutomationTaskStatus
): Promise<void> => {
  if (state.status === status) {
    return;
  }
  const completedAt = status === "done" ? (state.completedAt ?? run.now) : null;
  await writeTask(run, state, { completedAt, status });
  await recordActivity(run, "task.status_changed", {
    from: state.status,
    to: status,
  });
  state.status = status;
  state.completedAt = completedAt;
  state.statusChanged = true;
};

const setPriority = async (
  run: ActionRun,
  state: MutableState,
  priority: AutomationTaskPriority
): Promise<void> => {
  if (state.priority === priority) {
    return;
  }
  await writeTask(run, state, { priority });
  await recordActivity(run, "task.priority_changed", {
    from: state.priority,
    to: priority,
  });
  state.priority = priority;
  state.priorityChanged = true;
};

const assign = async (
  run: ActionRun,
  state: MutableState,
  action: Extract<AutomationAction, { type: "assign" }>
): Promise<void> => {
  await requireStaff(run.transaction, action, action.userId);
  if (state.assigneeIds.includes(action.userId)) {
    return;
  }
  await run.transaction.orm.public.TaskAssignee.create({
    assignedAt: run.now,
    assignedById: run.rule.createdById,
    taskId: run.task.id,
    userId: action.userId,
  });
  state.assigneeIds.push(action.userId);
  state.assigneesChanged = true;
  await recordActivity(run, "task.assigned", { userId: action.userId });
  await notifyUsers(run.transaction, {
    actorId: null,
    now: run.now,
    projectId: run.task.projectId,
    recipientIds: [action.userId],
    snippet: run.task.title,
    taskId: run.task.id,
    text: `Automation "${run.rule.name}" assigned you a task`,
    type: "assignment",
    url: `/tasks/${run.task.id}`,
  });
};

const unassign = async (
  run: ActionRun,
  state: MutableState,
  action: Extract<AutomationAction, { type: "unassign" }>
): Promise<void> => {
  if (!state.assigneeIds.includes(action.userId)) {
    return;
  }
  await run.transaction.orm.public.TaskAssignee.where({
    taskId: run.task.id,
    userId: action.userId,
  }).deleteAll();
  state.assigneeIds = state.assigneeIds.filter(
    (userId) => userId !== action.userId
  );
  state.assigneesChanged = true;
  await recordActivity(run, "task.unassigned", { userId: action.userId });
};

const addLabel = async (
  run: ActionRun,
  state: MutableState,
  action: Extract<AutomationAction, { type: "add_label" }>
): Promise<void> => {
  const label = await run.transaction.orm.public.Label.where({
    id: action.labelId,
  })
    .select("id")
    .first();
  if (!label) {
    throw unavailable(action, "that label no longer exists");
  }
  if (state.labelIds.includes(action.labelId)) {
    return;
  }
  await run.transaction.orm.public.TaskLabel.create({
    labelId: action.labelId,
    taskId: run.task.id,
  });
  state.labelIds.push(action.labelId);
  await recordActivity(run, "task.label_added", { labelId: action.labelId });
};

// Always internal: automation can never write something a client can read.
const postComment = async (
  run: ActionRun,
  action: Extract<AutomationAction, { type: "post_comment" }>
): Promise<void> => {
  const id = randomUUID();
  await run.transaction.orm.public.Comment.create({
    authorId: run.rule.createdById,
    body: `[Automation: ${run.rule.name}] ${action.body.trim()}`,
    createdAt: run.now,
    deletedAt: null,
    deletedById: null,
    id,
    taskId: run.task.id,
    updatedAt: run.now,
    visibility: "internal",
  });
  await recordActivity(run, "comment.created", {
    commentId: id,
    visibility: "internal",
  });
  await enqueueWebhookEvent(run.transaction, "comment.added", {
    data: {
      id,
      projectId: run.task.projectId,
      taskId: run.task.id,
      visibility: "internal",
    },
    now: run.now,
  });
};

const notify = async (
  run: ActionRun,
  action: Extract<AutomationAction, { type: "notify" }>
): Promise<void> => {
  await requireStaff(run.transaction, action, action.userId);
  await notifyUsers(run.transaction, {
    actorId: null,
    now: run.now,
    projectId: run.task.projectId,
    recipientIds: [action.userId],
    snippet: run.task.title,
    taskId: run.task.id,
    text: `Automation "${run.rule.name}": ${action.message.trim()}`,
    type: "update",
    url: `/tasks/${run.task.id}`,
  });
};

const applyOne = (
  run: ActionRun,
  state: MutableState,
  action: AutomationAction
): Promise<void> => {
  switch (action.type) {
    case "set_status": {
      return setStatus(run, state, action.status);
    }
    case "set_priority": {
      return setPriority(run, state, action.priority);
    }
    case "assign": {
      return assign(run, state, action);
    }
    case "unassign": {
      return unassign(run, state, action);
    }
    case "add_label": {
      return addLabel(run, state, action);
    }
    case "post_comment": {
      return postComment(run, action);
    }
    case "notify": {
      return notify(run, action);
    }
    default: {
      const unhandled: never = action;
      return Promise.reject(new Error(`Unhandled action ${String(unhandled)}`));
    }
  }
};

/**
 * Applies a rule's actions in order inside the caller's transaction, then
 * raises the follow-up events one automation hop deeper. Any failure throws
 * and the caller's rollback undoes every earlier action of the run.
 */
export const applyActions = async (
  run: ActionRun,
  actions: readonly AutomationAction[]
): Promise<FieldChanges> => {
  const state: MutableState = {
    assigneeIds: [...run.task.assigneeIds],
    assigneesChanged: false,
    completedAt: run.task.completedAt,
    labelIds: [...run.task.labelIds],
    priority: run.task.priority,
    priorityChanged: false,
    status: run.task.status,
    statusChanged: false,
    version: run.task.version,
  };
  for (const action of actions) {
    // Actions are ordered and each sees the previous one's result.
    // oxlint-disable-next-line no-await-in-loop, react-doctor/async-await-in-loop
    await applyOne(run, state, action);
  }
  const changes: FieldChanges = {
    assigneesChanged: state.assigneesChanged,
    priorityChanged: state.priorityChanged,
    statusChanged: state.statusChanged,
  };
  if (state.statusChanged || state.priorityChanged) {
    await enqueueTaskChange(run.transaction, {
      dueDate: run.task.dueDate,
      id: run.task.id,
      now: run.now,
      previousStatus: run.task.status,
      priority: state.priority,
      projectId: run.task.projectId,
      projectTaskNumber: run.task.projectTaskNumber,
      status: state.status,
      title: run.task.title,
    });
  }
  await Promise.all(
    eventsCausedBy({
      changes,
      depth: run.eventDepth,
      ruleId: run.rule.id,
    }).map((caused) =>
      enqueueAutomationEvent(run.transaction, {
        causedByRuleId: caused.causedByRuleId,
        depth: caused.depth,
        now: run.now,
        projectId: run.task.projectId,
        taskId: run.task.id,
        trigger: caused.trigger,
      })
    )
  );
  return changes;
};
