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

export interface TimelineMilestoneLane {
  // Only an admin can change a project's milestones.
  readonly editable: boolean;
  // Every milestone in position order, including undated ones: a save replaces
  // the whole list.
  readonly allMilestones: readonly {
    readonly completed: boolean;
    readonly dueDate: string | null;
    readonly id: string;
    readonly name: string;
  }[];
  readonly projectId: string;
  readonly projectName: string;
  readonly version: number;
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
