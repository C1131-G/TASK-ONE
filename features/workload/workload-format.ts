const WEEK_FORMATTER = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export const weekLabel = (weekStart: string): string =>
  WEEK_FORMATTER.format(new Date(`${weekStart}T00:00:00Z`));

export const taskCountLabel = (count: number): string =>
  `${count} ${count === 1 ? "task" : "tasks"}`;

export const hoursLabel = (hours: number): string => `${hours}h`;
