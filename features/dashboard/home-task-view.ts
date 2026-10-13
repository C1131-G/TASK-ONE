const HOME_TASK_VIEWS = ["upcoming", "overdue", "completed"] as const;

type HomeTaskView = (typeof HOME_TASK_VIEWS)[number];

const isHomeTaskView = (value: unknown): value is HomeTaskView =>
  HOME_TASK_VIEWS.some((view) => view === value);

// Unknown or missing ?taskView values fall back to the default list.
const parseHomeTaskView = (value: unknown): HomeTaskView =>
  isHomeTaskView(value) ? value : "upcoming";

export { parseHomeTaskView };
export type { HomeTaskView };
