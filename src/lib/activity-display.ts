import type { ActivityEntry } from "@/src/server/activity/activity-management";

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: "always",
  style: "narrow",
});
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
});
const activityVerbs: Readonly<Record<string, string>> = {
  "comment.created": "commented on",
  "comment.removal_undone": "restored a comment on",
  "comment.remove": "removed a comment from",
  "comment.removed": "removed a comment from",
  "project.archived": "archived project",
  "project.created": "created project",
  "project.restored": "restored project",
  "project.updated": "updated project",
  "task.archive": "archived",
  "task.archive_undone": "restored",
  "task.archived": "archived",
  "task.bulk_updated": "updated",
  "task.complete": "completed",
  "task.completion_undone": "reopened",
  "task.created": "created",
  "task.duplicated": "duplicated",
  "task.moved": "moved",
  "task.recurrence_generated": "scheduled a recurring copy of",
  "task.relations_updated": "updated task links for",
  "task.reordered": "reordered",
  "task.restored": "restored",
  "task.status_changed": "changed the status of",
  "task.updated": "updated",
};

export const getActivityVerb = (action: string): string =>
  activityVerbs[action] ?? action.replaceAll(".", " ").replaceAll("_", " ");

const isSameDay = (first: Date, second: Date): boolean =>
  first.getFullYear() === second.getFullYear() &&
  first.getMonth() === second.getMonth() &&
  first.getDate() === second.getDate();

export const getActivityGroup = (createdAt: string): string => {
  const date = new Date(createdAt);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(date, today)) {
    return "TODAY";
  }
  if (isSameDay(date, yesterday)) {
    return "YESTERDAY";
  }
  const startOfWeek = new Date(today);
  const daysSinceMonday = (today.getDay() + 6) % 7;
  startOfWeek.setDate(today.getDate() - daysSinceMonday);
  startOfWeek.setHours(0, 0, 0, 0);
  return date >= startOfWeek ? "THIS WEEK" : "EARLIER";
};

export const formatActivityGroup = (group: string): string =>
  ({
    EARLIER: "Earlier",
    "THIS WEEK": "This week",
    TODAY: "Today",
    YESTERDAY: "Yesterday",
  })[group] ?? group;

export const formatActivityTime = (createdAt: string): string => {
  const date = new Date(createdAt);
  const elapsedSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const elapsedMinutes = Math.round(Math.abs(elapsedSeconds) / 60);
  const elapsedHours = Math.round(Math.abs(elapsedSeconds) / 3600);
  const elapsedDays = Math.round(Math.abs(elapsedSeconds) / 86_400);

  if (elapsedMinutes < 60) {
    return relativeFormatter.format(
      Math.sign(elapsedSeconds) * Math.max(1, elapsedMinutes),
      "minute"
    );
  }
  if (elapsedHours < 24) {
    return relativeFormatter.format(
      Math.sign(elapsedSeconds) * elapsedHours,
      "hour"
    );
  }
  if (elapsedDays < 7) {
    return relativeFormatter.format(
      Math.sign(elapsedSeconds) * elapsedDays,
      "day"
    );
  }
  return dateFormatter.format(date);
};

export const groupActivityEntries = (
  entries: readonly ActivityEntry[]
): readonly (readonly [string, readonly ActivityEntry[]])[] => {
  const grouped = new Map<string, ActivityEntry[]>();
  for (const entry of entries) {
    const group = getActivityGroup(entry.createdAt);
    const current = grouped.get(group) ?? [];
    current.push(entry);
    grouped.set(group, current);
  }
  const order = ["TODAY", "YESTERDAY", "THIS WEEK", "EARLIER"];
  return [...grouped.entries()].toSorted(([left], [right]) => {
    const leftOrder = order.indexOf(left);
    const rightOrder = order.indexOf(right);
    if (leftOrder === -1 && rightOrder === -1) {
      return right.localeCompare(left);
    }
    if (leftOrder === -1) {
      return 1;
    }
    if (rightOrder === -1) {
      return -1;
    }
    return leftOrder - rightOrder;
  });
};
