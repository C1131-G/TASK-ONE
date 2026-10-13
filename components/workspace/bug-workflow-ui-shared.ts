import type { FormEvent } from "react";

import type { addBugFixAttemptAction } from "@/app/actions/bugs";
import type { BugHistorySchema } from "@/src/server/work/bug-history";

export type BugHistory = typeof BugHistorySchema.Type;
export type BugActionResult = Awaited<
  ReturnType<typeof addBugFixAttemptAction>
>;
export type BugSubmit = (
  event: FormEvent<HTMLFormElement>,
  action: (data: FormData) => Promise<BugActionResult>
) => void;
export type BugActionRunner = (action: Promise<BugActionResult>) => void;

const bugDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export const formatBugDate = (value: string): string =>
  bugDateFormatter.format(new Date(value));
