import { Bell, ChatCircle, UserPlus } from "@phosphor-icons/react";

export type NotificationFilter = "all" | "unread";
export type DateBucket = "Today" | "Yesterday" | "This week" | "Earlier";

export const DATE_BUCKETS: readonly DateBucket[] = [
  "Today",
  "Yesterday",
  "This week",
  "Earlier",
];
export const DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});
const DATE_ONLY_FORMATTER = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
});

export const getDateBucket = (value: string): DateBucket => {
  const today = new Date();
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  );
  const date = new Date(value);
  const valueUtc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  );
  const daysAgo = Math.floor((todayUtc - valueUtc) / 86_400_000);
  if (daysAgo === 0) {
    return "Today";
  }
  if (daysAgo === 1) {
    return "Yesterday";
  }
  return daysAgo < 7 ? "This week" : "Earlier";
};

export const formatRelativeTime = (value: string): string => {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) {
    return `${Math.max(1, minutes)}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return days < 7
    ? `${days}d ago`
    : DATE_ONLY_FORMATTER.format(new Date(value));
};

export const getNotificationIcon = (type: string) => {
  if (type === "mention" || type === "comment") {
    return ChatCircle;
  }
  if (type === "assignment") {
    return UserPlus;
  }
  return Bell;
};
