export interface TimelineTask {
  readonly id: string;
  readonly title: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly startDate: string | null;
  readonly dueDate: string | null;
  readonly status: string;
  readonly priority?: string;
  readonly assigneeIds?: readonly string[];
  readonly position?: number;
  readonly version: number;
}

export interface TimelineMilestone {
  readonly completed: boolean;
  readonly dueDate: string;
  readonly id: string;
  readonly name: string;
}

export interface TimelineMilestoneLane {
  readonly milestones: readonly TimelineMilestone[];
  readonly projectId: string;
  readonly projectName: string;
}

export interface TimelineEmployee {
  readonly id: string;
  readonly name: string;
}

export interface TimelineGroup {
  readonly key: string;
  readonly label: string;
  readonly tasks: readonly TimelineTask[];
}

export type TimelineRow =
  | { readonly type: "group"; readonly key: string; readonly label: string }
  | {
      readonly type: "milestones";
      readonly key: string;
      readonly lane: TimelineMilestoneLane;
    }
  | {
      readonly type: "task";
      readonly key: string;
      readonly task: TimelineTask;
    };

export type TimelineScale = "week" | "month";
