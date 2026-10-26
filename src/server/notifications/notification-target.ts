import type { db } from "@/src/prisma/db";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type NotificationTargetType = "task" | "bug" | "approval";

// What a notification is about, kept on the row so it can be opened later.
export interface NotificationTarget {
  readonly id: string;
  readonly type: NotificationTargetType;
}

// A notification about a task points at its bug when the task is a bug report,
// since the bug is the record people open, and at the task otherwise.
export const resolveTaskTarget = async (
  transaction: Transaction,
  taskId: string | null
): Promise<NotificationTarget | null> => {
  if (!taskId) {
    return null;
  }
  const bug = await transaction.orm.public.BugReport.where({ taskId })
    .select("id")
    .first();
  return bug ? { id: bug.id, type: "bug" } : { id: taskId, type: "task" };
};
