import { createHash } from "node:crypto";

import { and } from "@prisma/orm-postgres/orm-client";

import { db } from "@/src/prisma/db";

import { enqueueAutomationEvent } from "./automation-enqueue";

// Only tasks that became overdue recently are considered. A job and its run
// log outlive this window (see data-retention), so a task is never reported
// twice once it ages out of the window and its records are purged.
export const OVERDUE_LOOKBACK_DAYS = 7;
const DAY_MS = 86_400_000;
const ISO_DATE_LENGTH = 10;
const UUID_TIME_HIGH_START = 12;
const UUID_VARIANT_START = 16;
const UUID_VARIANT_RANGE = 0x40;
const UUID_VARIANT_MARK = 0x80;
const HEX_RADIX = 16;

/**
 * One id per (task, due date): a sweep that sees the same overdue task again
 * produces the same event, so the rule runs once. Moving the due date and
 * missing it again is a new event.
 */
export const overdueEventId = (taskId: string, dueDate: string): string => {
  const hex = createHash("sha256")
    .update(`overdue:${taskId}:${dueDate}`)
    .digest("hex");
  // RFC 4122 variant: the top two bits of the byte are 10.
  const variant = (
    (Number.parseInt(
      hex.slice(UUID_VARIANT_START, UUID_VARIANT_START + 2),
      HEX_RADIX
    ) %
      UUID_VARIANT_RANGE) +
    UUID_VARIANT_MARK
  ).toString(HEX_RADIX);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(UUID_TIME_HIGH_START + 1, UUID_TIME_HIGH_START + 4)}`,
    `${variant}${hex.slice(UUID_VARIANT_START + 2, UUID_VARIANT_START + 4)}`,
    hex.slice(20, 32),
  ].join("-");
};

const daysBefore = (today: string, days: number): string =>
  new Date(Date.parse(`${today}T00:00:00.000Z`) - days * DAY_MS)
    .toISOString()
    .slice(0, ISO_DATE_LENGTH);

/**
 * Raises task_overdue for open tasks whose due date has passed, in projects
 * that have an enabled rule for it. Returns how many events it queued.
 */
export const sweepOverdueTasks = async (
  today: string,
  now: Date
): Promise<number> => {
  const rules = await db.orm.public.AutomationRule.where({
    enabled: true,
    trigger: "task_overdue",
  })
    .select("projectId")
    .all();
  const projectIds = [...new Set(rules.map(({ projectId }) => projectId))];
  if (projectIds.length === 0) {
    return 0;
  }
  const earliest = daysBefore(today, OVERDUE_LOOKBACK_DAYS);
  const tasks = await db.orm.public.Task.where((task) =>
    and(
      task.projectId.in(projectIds),
      task.archivedAt.isNull(),
      task.status.neq("done"),
      task.dueDate.lt(today),
      task.dueDate.gte(earliest)
    )
  )
    .select("id", "projectId", "dueDate")
    .all();
  let queued = 0;
  for (const task of tasks) {
    if (task.dueDate === null) {
      continue;
    }
    const eventId = overdueEventId(task.id, task.dueDate);
    // eslint-disable-next-line no-await-in-loop
    const raised = await db.transaction((transaction) =>
      enqueueAutomationEvent(transaction, {
        eventId,
        now,
        projectId: task.projectId,
        taskId: task.id,
        trigger: "task_overdue",
      })
    );
    queued += raised ? 1 : 0;
  }
  return queued;
};
