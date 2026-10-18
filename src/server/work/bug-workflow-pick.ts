import { randomUUID } from "node:crypto";

import { and } from "@prisma/orm-postgres/orm-client";
import { Schema } from "effect";

import { AppError } from "../core/action-result";
import { activeAdminIds, notifyUsers } from "../notifications/notify-users";
import type { BugPickInput } from "./bug-contracts";
import { BugPickInputSchema } from "./bug-contracts";
import {
  assertWritable,
  conflict,
  forbidden,
  loadBug,
  workspaceActor,
  writeActivity,
} from "./bug-workflow-internal";
import type { BugWorkflowReceipt } from "./bug-workflow-internal";
import { applyTriage } from "./bug-workflow-triage";
import type { Transaction } from "./work-internal";

const UNPICKED_REMINDER_DELAY_MS = 24 * 60 * 60 * 1000;
export const UNPICKED_REMINDER_JOB = "bug.client_unpicked_reminder";
export const CLOSED_STATUSES = new Set(["closed", "duplicate", "withdrawn"]);

export const bugKey = (
  project: { readonly key: string },
  task: {
    readonly projectTaskNumber: number;
  }
): string => `${project.key}-${task.projectTaskNumber}`;

// A new client report tells the company's handlers (or the admins when the
// company has none) and starts the 24-hour clock for someone to pick it.
export const announceClientBug = async (
  transaction: Transaction,
  input: {
    readonly bugId: string;
    readonly reporterId: string;
    readonly now: Date;
  }
): Promise<void> => {
  const { bug, project, task } = await loadBug(transaction, input.bugId);
  if (!bug.clientCompanyId) {
    return;
  }
  const [company, handlerRows] = await Promise.all([
    transaction.orm.public.ClientCompany.where({ id: bug.clientCompanyId })
      .select("name")
      .first(),
    transaction.orm.public.ClientCompanyHandler.where({
      companyId: bug.clientCompanyId,
    })
      .select("employeeId")
      .all(),
  ]);
  const handlerIds = handlerRows.map(({ employeeId }) => employeeId);
  const activeHandlers =
    handlerIds.length === 0
      ? []
      : await transaction.orm.public.User.where((user) =>
          and(user.id.in(handlerIds), user.deactivatedAt.isNull())
        )
          .select("id")
          .all();
  const recipients =
    activeHandlers.length > 0
      ? activeHandlers.map(({ id }) => id)
      : await activeAdminIds(transaction);
  await notifyUsers(transaction, {
    actorId: input.reporterId,
    now: input.now,
    projectId: project.id,
    recipientIds: recipients,
    snippet: `${bugKey(project, task)} ${task.title}`,
    taskId: task.id,
    text: `New bug from ${company?.name ?? "a client"}`,
    type: "client_bug",
    url: `/bugs/${bug.id}`,
  });
  await transaction.orm.public.Job.upsert({
    conflictOn: { dedupeKey: `${UNPICKED_REMINDER_JOB}:${bug.id}` },
    create: {
      availableAt: new Date(input.now.getTime() + UNPICKED_REMINDER_DELAY_MS),
      createdAt: input.now,
      dedupeKey: `${UNPICKED_REMINDER_JOB}:${bug.id}`,
      id: randomUUID(),
      kind: UNPICKED_REMINDER_JOB,
      payload: { bugId: bug.id },
      updatedAt: input.now,
    },
    update: { updatedAt: input.now },
  });
};

// Nags the admins once if a client report is still waiting 24 hours on.
export const remindUnpickedClientBug = async (
  transaction: Transaction,
  bugId: string
): Promise<boolean> => {
  const bug = await transaction.orm.public.BugReport.where({
    id: bugId,
  }).first();
  if (
    !bug ||
    !bug.clientCompanyId ||
    bug.status !== "reported" ||
    bug.pickedById
  ) {
    return false;
  }
  const [{ project, task }, company, admins] = await Promise.all([
    loadBug(transaction, bug.id),
    transaction.orm.public.ClientCompany.where({ id: bug.clientCompanyId })
      .select("name")
      .first(),
    activeAdminIds(transaction),
  ]);
  await notifyUsers(transaction, {
    actorId: null,
    now: new Date(),
    projectId: project.id,
    recipientIds: admins,
    snippet: `${bugKey(project, task)} ${task.title}`,
    taskId: task.id,
    text: `Nobody has picked up a ${company?.name ?? "client"} bug in 24 hours`,
    type: "client_bug",
    url: `/bugs/${bug.id}`,
  });
  return true;
};

const alreadyPicked = async (
  transaction: Transaction,
  bugId: string
): Promise<never> => {
  const current = await transaction.orm.public.BugReport.where({ id: bugId })
    .select("pickedById")
    .first();
  const picker = current?.pickedById
    ? await transaction.orm.public.User.where({ id: current.pickedById })
        .select("name")
        .first()
    : null;
  throw new AppError({
    code: "CONFLICT",
    message: picker
      ? `Already picked by ${picker.name}.`
      : "The bug changed. Refresh and try again.",
  });
};

// The first handler to pick a client report owns it, triages it, and tells
// the admins. Two handlers racing is settled by the version-guarded claim.
export const pickClientBug = async (
  transaction: Transaction,
  actorId: string,
  rawInput: BugPickInput
): Promise<BugWorkflowReceipt> => {
  const input = Schema.decodeUnknownSync(BugPickInputSchema)(rawInput);
  const [actor, context] = await Promise.all([
    workspaceActor(transaction, actorId),
    loadBug(transaction, input.bugId),
  ]);
  const { bug, project, task } = context;
  if (!bug.clientCompanyId) {
    forbidden("Only client reports can be picked.");
  }
  if (actor.role !== "employee") {
    forbidden("Admins assign client bugs from the triage form.");
  }
  const companyId = bug.clientCompanyId ?? "";
  const [handler, company] = await Promise.all([
    transaction.orm.public.ClientCompanyHandler.where({
      companyId,
      employeeId: actorId,
    })
      .select("id")
      .first(),
    transaction.orm.public.ClientCompany.where({ id: companyId })
      .select("deactivatedAt")
      .first(),
  ]);
  if (!handler) {
    forbidden("Only a handler of this client company can pick its bugs.");
  }
  if (company?.deactivatedAt) {
    forbidden("This client company is deactivated.");
  }
  assertWritable(bug, task, project);
  if (bug.pickedById) {
    return alreadyPicked(transaction, bug.id);
  }
  if (bug.status !== "reported" || bug.version !== input.expectedVersion) {
    conflict();
  }
  const now = new Date();
  const claimed = await transaction.orm.public.BugReport.where({
    id: bug.id,
    pickedById: null,
    status: "reported",
    version: bug.version,
  }).updateAndCount({
    pickedAt: now,
    pickedById: actorId,
    updatedAt: now,
    version: bug.version + 1,
  });
  if (!claimed) {
    return alreadyPicked(transaction, bug.id);
  }
  const result = await applyTriage(
    transaction,
    actor,
    {
      bug: {
        ...bug,
        pickedAt: now,
        pickedById: actorId,
        version: bug.version + 1,
      },
      project,
      task,
    },
    {
      assigneeIds: [actorId],
      priority: input.priority,
      severity: input.severity,
    }
  );
  await writeActivity(transaction, {
    action: "bug.picked",
    actorId,
    bugId: bug.id,
    details: { pickedById: actorId },
    now,
    projectId: project.id,
    taskId: task.id,
  });
  await notifyUsers(transaction, {
    actorId,
    now,
    projectId: project.id,
    recipientIds: await activeAdminIds(transaction),
    snippet: task.title,
    taskId: task.id,
    text: `${actor.name} picked ${bugKey(project, task)}`,
    type: "client_bug",
    url: `/bugs/${bug.id}`,
  });
  return result;
};
