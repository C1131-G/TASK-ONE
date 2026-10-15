import { randomUUID } from "node:crypto";

import { Schema } from "effect";

import { AppError } from "../core/action-result";
import { UUIDSchema } from "../core/input-schemas";
import type { BugRelationInput } from "./bug-contracts";
import { BugWorkflowStatusSchema } from "./bug-contracts";
import type { Transaction } from "./work-internal";

export const BugWorkflowReceiptSchema = Schema.Struct({
  bugId: UUIDSchema,
  status: BugWorkflowStatusSchema,
  version: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
});

export type BugWorkflowReceipt = typeof BugWorkflowReceiptSchema.Type;

// Bug rows store the status as text; decoding rejects a value outside the workflow.
export const decodeBugWorkflowStatus = Schema.decodeUnknownSync(
  BugWorkflowStatusSchema
);

export const required = (message: string): never => {
  throw new AppError({ code: "VALIDATION_FAILED", message });
};

export const requirePresent = <Value>(
  value: Value | null | undefined,
  message: string
): Value => {
  if (value === null || value === undefined) {
    required(message);
  }
  return value ?? required(message);
};

export const forbidden = (message: string): never => {
  throw new AppError({ code: "FORBIDDEN", message });
};

export const conflict = (): never => {
  throw new AppError({
    code: "CONFLICT",
    message: "The bug changed. Refresh and try again.",
  });
};

export const workspaceActor = async (
  transaction: Transaction,
  actorId: string
) => {
  const actor = await transaction.orm.public.User.where({ id: actorId })
    .select("id", "name", "role", "deactivatedAt", "mustChangePassword")
    .first();
  if (!actor || actor.deactivatedAt) {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Sign in to continue.",
    });
  }
  if (actor.mustChangePassword) {
    forbidden("Change your password before continuing.");
  }
  if (actor.role === "client") {
    forbidden("This area is only available to workspace members.");
  }
  return actor;
};

export const loadBug = async (transaction: Transaction, bugId: string) => {
  const bug = await transaction.orm.public.BugReport.where({
    id: bugId,
  }).first();
  if (!bug) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "The bug report was not found.",
    });
  }
  const [task, project] = await Promise.all([
    transaction.orm.public.Task.where({ id: bug.taskId }).first(),
    transaction.orm.public.Project.where({ id: bug.projectId }).first(),
  ]);
  if (!task || !project) {
    throw new AppError({
      code: "UNAVAILABLE",
      message: "The bug report could not be loaded.",
    });
  }
  return { bug, project, task };
};

export const assertBugEditor = async (
  transaction: Transaction,
  actor: { readonly id: string; readonly role: string },
  bug: { readonly reporterId: string; readonly taskId: string }
): Promise<void> => {
  if (actor.role === "admin" || bug.reporterId === actor.id) {
    return;
  }
  const assignment = await transaction.orm.public.TaskAssignee.where({
    taskId: bug.taskId,
    userId: actor.id,
  }).first();
  if (!assignment) {
    forbidden(
      "Only the bug reporter, assignees, and admins can edit this bug."
    );
  }
};

export const assertWritable = (
  bug: { readonly status: string },
  task: { readonly archivedAt: Date | null },
  project: { readonly archivedAt: Date | null }
): void => {
  if (
    task.archivedAt ||
    project.archivedAt ||
    [
      "closed",
      "duplicate",
      "awaiting_admin_approval",
      "approved_for_release",
      "released",
      "awaiting_client",
      "withdrawn",
    ].includes(bug.status)
  ) {
    forbidden(
      "Archived or completed bugs are read only until an admin restores or reopens them."
    );
  }
};

export const hasRelationPath = async (
  transaction: Transaction,
  startBugId: string,
  targetBugId: string,
  type: BugRelationInput["type"]
): Promise<boolean> => {
  const relations = await transaction.orm.public.BugRelation.where({ type })
    .select("fromBugReportId", "toBugReportId")
    .all();
  const outgoing = new Map<string, string[]>();
  for (const relation of relations) {
    const neighbors = outgoing.get(relation.fromBugReportId) ?? [];
    neighbors.push(relation.toBugReportId);
    outgoing.set(relation.fromBugReportId, neighbors);
  }
  const visited = new Set<string>();
  let frontier = [startBugId];
  while (frontier.length > 0) {
    const current = frontier.filter((id) => !visited.has(id));
    if (current.length === 0) {
      return false;
    }
    if (current.includes(targetBugId)) {
      return true;
    }
    for (const id of current) {
      visited.add(id);
    }
    frontier = current.flatMap((id) => outgoing.get(id) ?? []);
  }
  return false;
};

export const writeActivity = async (
  transaction: Transaction,
  input: {
    readonly action: string;
    readonly actorId: string;
    readonly bugId: string;
    readonly projectId: string;
    readonly taskId: string;
    readonly details: object;
    readonly now: Date;
  }
): Promise<void> => {
  await transaction.orm.public.Activity.create({
    action: input.action,
    actorId: input.actorId,
    createdAt: input.now,
    details: { bugId: input.bugId, ...input.details },
    id: randomUUID(),
    projectId: input.projectId,
    taskId: input.taskId,
  });
};

export const taskStatusByBugStage = {
  approved_for_release: "review",
  awaiting_admin_approval: "review",
  awaiting_client: "review",
  closed: "done",
  duplicate: "done",
  in_progress: "progress",
  in_verification: "review",
  needs_info: "progress",
  rejected: "progress",
  released: "review",
  reported: "backlog",
  triaged: "backlog",
  withdrawn: "done",
} as const satisfies Record<
  typeof BugWorkflowStatusSchema.Type,
  "backlog" | "progress" | "review" | "done"
>;

const completedBugStatuses: ReadonlySet<string> = new Set([
  "closed",
  "duplicate",
  "withdrawn",
]);

export const updateBugStatus = async (
  transaction: Transaction,
  input: {
    readonly bug: {
      readonly id: string;
      readonly projectId: string;
      readonly status: string;
      readonly taskId: string;
      readonly version: number;
    };
    readonly actorId: string;
    readonly nextStatus: typeof BugWorkflowStatusSchema.Type;
    readonly now: Date;
    readonly details?: object;
    // Other bug columns that change together with the status.
    readonly fields?: Record<string, unknown>;
  }
): Promise<BugWorkflowReceipt> => {
  const version = input.bug.version + 1;
  const task = await transaction.orm.public.Task.where({
    id: input.bug.taskId,
  }).first();
  if (!task) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "The bug task was not found.",
    });
  }
  const updated = await transaction.orm.public.BugReport.where({
    id: input.bug.id,
    version: input.bug.version,
  }).updateAndCount({
    ...input.fields,
    status: input.nextStatus,
    updatedAt: input.now,
    version,
  });
  if (!updated) {
    conflict();
  }
  const taskStatus = taskStatusByBugStage[input.nextStatus];
  const taskUpdated = await transaction.orm.public.Task.where({
    id: task.id,
    version: task.version,
  }).updateAndCount({
    completedAt: completedBugStatuses.has(input.nextStatus) ? input.now : null,
    status: taskStatus,
    updatedAt: input.now,
    version: task.version + 1,
  });
  if (!taskUpdated) {
    conflict();
  }
  await writeActivity(transaction, {
    action: "bug.status_changed",
    actorId: input.actorId,
    bugId: input.bug.id,
    details: { from: input.bug.status, to: input.nextStatus, ...input.details },
    now: input.now,
    projectId: input.bug.projectId,
    taskId: input.bug.taskId,
  });
  return Schema.decodeUnknownSync(BugWorkflowReceiptSchema)({
    bugId: input.bug.id,
    status: input.nextStatus,
    version,
  });
};

export const validateExternalUrl = (url: string | null): void => {
  if (url === null) {
    return;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return required("Enter a valid evidence URL.");
  }
  if (parsed.protocol !== "https:" || !parsed.hostname) {
    required("Evidence links must use HTTPS.");
  }
};
