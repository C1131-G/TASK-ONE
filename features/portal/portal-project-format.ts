import type {
  PortalSharedProjectDetail,
  PortalSharedProjectSummary,
} from "@/src/server/portal/portal-project-contracts";

type ProjectStatus = PortalSharedProjectSummary["status"];
type TaskStatus = PortalSharedProjectDetail["tasks"][number]["status"];

export const projectStatusText: Record<ProjectStatus, string> = {
  active: "In progress",
  complete: "Complete",
  hold: "On hold",
  planning: "Planning",
  risk: "At risk",
};

export const projectStatusTone: Record<
  ProjectStatus,
  "accent" | "amber" | "gray" | "green" | "violet"
> = {
  active: "accent",
  complete: "green",
  hold: "gray",
  planning: "violet",
  risk: "amber",
};

export const taskStatusText: Record<TaskStatus, string> = {
  backlog: "Planned",
  done: "Done",
  progress: "In progress",
  review: "In review",
  todo: "To do",
};

export const taskStatusTone: Record<
  TaskStatus,
  "accent" | "amber" | "gray" | "green" | "violet"
> = {
  backlog: "gray",
  done: "green",
  progress: "amber",
  review: "violet",
  todo: "gray",
};

export const progressPercent = (
  progress: PortalSharedProjectSummary["progress"]
): number =>
  progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100);

export const progressText = (
  progress: PortalSharedProjectSummary["progress"]
): string =>
  progress.total === 0
    ? "No shared tasks yet"
    : `${progress.done} of ${progress.total} tasks done`;
