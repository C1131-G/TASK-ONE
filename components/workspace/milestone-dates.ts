import { addDays } from "@/components/workspace/task-dates";

// A project's full milestone list, in position order. Saving replaces the whole
// list, so a move must send every milestone, including undated ones.
export interface MilestoneRecord {
  readonly completed: boolean;
  readonly dueDate: string | null;
  readonly id: string;
  readonly name: string;
}

export const milestoneDateAfterDrag = (dueDate: string, days: number): string =>
  addDays(dueDate, days);

export const withMilestoneDate = (
  milestones: readonly MilestoneRecord[],
  milestoneId: string,
  dueDate: string
): readonly MilestoneRecord[] =>
  milestones.map((milestone) =>
    milestone.id === milestoneId ? { ...milestone, dueDate } : milestone
  );
