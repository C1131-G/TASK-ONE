const taskStatuses = [
  ["backlog", "Backlog"],
  ["todo", "To Do"],
  ["progress", "In Progress"],
  ["review", "Review"],
  ["done", "Done"],
] as const;
const projectStatusLabels = {
  active: "In Progress",
  complete: "Completed",
  hold: "On Hold",
  planning: "Planning",
  risk: "At Risk",
} as const;

const milestoneDateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export { milestoneDateFormatter, projectStatusLabels, taskStatuses };
