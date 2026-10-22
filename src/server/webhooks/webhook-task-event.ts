import type { db } from "@/src/prisma/db";

import { enqueueWebhookEvent } from "./webhook-enqueue";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface TaskChange {
  readonly id: string;
  readonly projectId: string;
  readonly projectTaskNumber: number;
  readonly title: string;
  readonly priority: string;
  readonly dueDate: Date | string | null;
  readonly previousStatus: string;
  readonly status: string;
  readonly now: Date;
}

/**
 * Reports an edit to an existing task. Moving a task into "done" is reported
 * as task.completed instead of task.updated, so a subscriber to both never
 * receives two messages for one change.
 */
export const enqueueTaskChange = (
  transaction: Transaction,
  { now, previousStatus, ...task }: TaskChange
): Promise<void> =>
  enqueueWebhookEvent(
    transaction,
    previousStatus !== "done" && task.status === "done"
      ? "task.completed"
      : "task.updated",
    { data: task, now }
  );
