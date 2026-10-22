import { randomUUID } from "node:crypto";

import { and } from "@prisma/orm-postgres/orm-client";

import type { db } from "@/src/prisma/db";

import { notifyUsers } from "../notifications/notify-users";
import { enqueueTaskChange } from "../webhooks/webhook-task-event";
import type { PullEvent } from "./github-payload";
import { extractTaskNumbers, sanitizePullTitle } from "./github-references";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface SyncConnection {
  readonly id: string;
  readonly repoFullName: string;
  readonly projectId: string;
  readonly autoCompleteOnMerge: boolean;
  readonly createdById: string;
}

export interface SyncOutcome {
  readonly linked: number;
  readonly completed: number;
}

interface LinkableTask {
  readonly id: string;
  readonly projectId: string;
  readonly projectTaskNumber: number;
  readonly title: string;
  readonly type: string;
  readonly status: string;
  readonly priority: string;
  readonly dueDate: Date | string | null;
  readonly createdById: string;
  readonly version: number;
}

// The link points at the repository's own pull request page, built from the
// repository and number. The payload's URL is never stored.
const pullUrl = (repoFullName: string, number: number): string =>
  `https://github.com/${repoFullName}/pull/${number}`;

const upsertLink = async (
  transaction: Transaction,
  connection: SyncConnection,
  event: PullEvent,
  taskId: string,
  now: Date
): Promise<string | null> => {
  const scope = {
    connectionId: connection.id,
    prNumber: event.number,
    taskId,
  };
  const current =
    await transaction.orm.public.GithubPullLink.where(scope).first();
  const fields = {
    authorLogin: event.authorLogin,
    mergedAt:
      event.state === "merged"
        ? (event.mergedAt ?? current?.mergedAt ?? now)
        : null,
    state: event.state,
    title: sanitizePullTitle(event.title),
    updatedAt: now,
  };
  if (current) {
    await transaction.orm.public.GithubPullLink.where({
      id: current.id,
    }).update(fields);
    return current.state;
  }
  await transaction.orm.public.GithubPullLink.create({
    ...scope,
    ...fields,
    createdAt: now,
    id: randomUUID(),
    url: pullUrl(connection.repoFullName, event.number),
  });
  return null;
};

const completeTask = async (
  transaction: Transaction,
  connection: SyncConnection,
  event: PullEvent,
  task: LinkableTask,
  now: Date
): Promise<boolean> => {
  const version = task.version + 1;
  const updated = await transaction.orm.public.Task.where({
    id: task.id,
    version: task.version,
  }).updateAndCount({
    completedAt: now,
    status: "done",
    updatedAt: now,
    version,
  });
  if (!updated) {
    return false;
  }
  await transaction.orm.public.Activity.create({
    action: "task.status_changed",
    actorId: connection.createdById,
    createdAt: now,
    details: {
      from: task.status,
      pullNumber: event.number,
      repository: connection.repoFullName,
      source: "github",
      to: "done",
    },
    id: randomUUID(),
    projectId: task.projectId,
    taskId: task.id,
  });
  await enqueueTaskChange(transaction, {
    dueDate: task.dueDate,
    id: task.id,
    now,
    previousStatus: task.status,
    priority: task.priority,
    projectId: task.projectId,
    projectTaskNumber: task.projectTaskNumber,
    status: "done",
    title: task.title,
  });
  const assignees = await transaction.orm.public.TaskAssignee.where({
    taskId: task.id,
  })
    .select("userId")
    .all();
  await notifyUsers(transaction, {
    actorId: connection.createdById,
    now,
    projectId: task.projectId,
    recipientIds: [task.createdById, ...assignees.map(({ userId }) => userId)],
    snippet: sanitizePullTitle(event.title),
    taskId: task.id,
    text: `${task.title} was completed by merging pull request #${event.number}`,
    type: "status",
    url: `/tasks/${task.id}`,
  });
  return true;
};

// Only an ordinary task that is not finished and not recurring completes from
// a merge; a recurring task needs its successor, and bugs have a workflow.
const completable = async (
  transaction: Transaction,
  task: LinkableTask
): Promise<boolean> => {
  if (task.status === "done" || task.type === "bug") {
    return false;
  }
  const recurrence = await transaction.orm.public.TaskRecurrence.where({
    taskId: task.id,
  })
    .select("id")
    .first();
  return !recurrence;
};

// Returns true when this event completed the task.
const syncTask = async (
  transaction: Transaction,
  connection: SyncConnection,
  event: PullEvent,
  task: LinkableTask,
  now: Date
): Promise<boolean> => {
  const previous = await upsertLink(
    transaction,
    connection,
    event,
    task.id,
    now
  );
  const firstMerge = event.state === "merged" && previous !== "merged";
  if (!connection.autoCompleteOnMerge || !firstMerge) {
    return false;
  }
  return (
    (await completable(transaction, task)) &&
    (await completeTask(transaction, connection, event, task, now))
  );
};

/**
 * Links the pull request to every task its title, branch or body names in the
 * connection's own project, and completes those tasks on a first merge when
 * the connection allows it. Safe to run twice for the same event.
 */
export const syncPull = async (
  transaction: Transaction,
  connection: SyncConnection,
  event: PullEvent,
  now: Date
): Promise<SyncOutcome> => {
  const project = await transaction.orm.public.Project.where({
    id: connection.projectId,
  })
    .select("key")
    .first();
  if (!project) {
    return { completed: 0, linked: 0 };
  }
  const numbers = extractTaskNumbers(project.key, [
    event.title,
    event.branch,
    event.body,
  ]);
  if (numbers.length === 0) {
    return { completed: 0, linked: 0 };
  }
  const tasks = await transaction.orm.public.Task.where((task) =>
    and(
      task.projectId.eq(connection.projectId),
      task.projectTaskNumber.in(numbers),
      task.archivedAt.isNull()
    )
  ).all();
  // One failure rolls the whole event back with the surrounding transaction.
  const results = await Promise.all(
    tasks.map((task) => syncTask(transaction, connection, event, task, now))
  );
  return {
    completed: results.filter(Boolean).length,
    linked: tasks.length,
  };
};
