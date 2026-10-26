import { screen, userEvent, waitFor } from "@testing-library/react-native";
import { Effect } from "effect";

import { ValidationFailed } from "@/errors";
import {
  filterTasks,
  MyTasksScreen,
  TaskDetailScreen,
  type TaskRowModel,
} from "@/features/tasks/task-screens";
import type { ApiContextValue, KeysContextValue } from "@/runtime/api-hooks";
import { renderWithTheme } from "../components/support/theme";

const TASKS: readonly TaskRowModel[] = [
  {
    dueAt: "2026-11-02T00:00:00.000Z",
    id: "task-1",
    priority: "high",
    projectName: "Website relaunch",
    status: "progress",
    title: "Ship the landing page",
  },
  {
    dueAt: null,
    id: "task-2",
    priority: "medium",
    projectName: "Website relaunch",
    status: "todo",
    title: "Draft the announcement",
  },
  {
    dueAt: null,
    id: "task-3",
    priority: "low",
    projectName: "Client portal",
    status: "done",
    title: "Set up staging",
  },
];

it("filters the task list by status", () => {
  expect(filterTasks(TASKS, "all").length).toBe(3);
  expect(filterTasks(TASKS, "todo").map((task) => task.id)).toEqual(["task-2"]);
  expect(filterTasks(TASKS, "progress")[0]?.title).toBe("Ship the landing page");
});

it("renders the rows and opens a task", async () => {
  let opened: string | null = null;
  const user = userEvent.setup();
  await renderWithTheme(
    <MyTasksScreen
      onOpenTask={(id) => {
        opened = id;
      }}
      tasks={TASKS}
    />,
  );

  expect(screen.getByText("3 of 3 tasks")).toBeTruthy();

  await user.press(screen.getByRole("button", { name: "Open task Ship the landing page" }));

  expect(opened).toBe("task-1");
});

it("filters the visible rows through the chips", async () => {
  const user = userEvent.setup();
  await renderWithTheme(<MyTasksScreen onOpenTask={() => undefined} tasks={TASKS} />);

  await user.press(screen.getByRole("button", { name: "done" }));

  expect(screen.getByText("1 of 3 tasks")).toBeTruthy();
  expect(screen.queryByText("Open task Ship the landing page")).toBeNull();
});


const keysStub: KeysContextValue = {
  forget: () => Effect.void,
  run: (_intent, program) => program("key-1234567890"),
};

const SUBTASKS = [
  { completed: true, id: "sub-1", title: "Hero art" },
  { completed: false, id: "sub-2", title: "Launch checklist" },
];

const detail = (overrides: Partial<Parameters<typeof TaskDetailScreen>[0]["task"]> = {}) => ({
  projectName: "Website relaunch",
  status: "progress" as const,
  subtasks: SUBTASKS,
  title: "Ship the landing page",
  version: 3,
  ...overrides,
});

const apiWith = (client: Record<string, unknown>) =>
  ({
    call: (run: (client: unknown) => Promise<unknown>) =>
      Effect.tryPromise({
        catch: () => new ValidationFailed({ fieldErrors: {} }),
        try: () => run(client),
      }),
  }) as unknown as ApiContextValue;

it("shows the task's subtasks and toggles one", async () => {
  const toggled: boolean[] = [];
  const api = apiWith({
    setSubtaskStatus: (input: { readonly body: { readonly done: boolean } }) => {
      toggled.push(input.body.done);
      return Promise.resolve({ done: input.body.done, version: 4 });
    },
  });

  await renderWithTheme(
    <TaskDetailScreen api={api} keys={keysStub} task={detail()} taskId="task-1" />,
  );

  expect(screen.getByText("Hero art")).toBeTruthy();
  const user = userEvent.setup();
  await user.press(screen.getByRole("button", { name: "Toggle subtask Launch checklist" }));

  await waitFor(() => expect(toggled).toEqual([true]));
});

it("moves the status with the version the screen last saw", async () => {
  const sent: unknown[] = [];
  const api = apiWith({
    changeTask: (input: unknown) => {
      sent.push(input);
      return Promise.resolve({ status: "done", version: 4 });
    },
  });

  await renderWithTheme(
    <TaskDetailScreen api={api} keys={keysStub} task={detail()} taskId="task-1" />,
  );
  const user = userEvent.setup();
  await user.press(screen.getByRole("button", { name: "Change status" }));
  await user.press(screen.getByRole("radio", { name: "done" }));

  await waitFor(() => expect(sent.length).toBe(1));
  expect(sent[0]).toMatchObject({
    body: { expectedVersion: 3, status: "done" },
    idempotencyKey: "key-1234567890",
    params: { taskId: "task-1" },
  });
});

it("tells the user when a status move fails", async () => {
  const api = {
    call: () => Effect.fail(new ValidationFailed({ fieldErrors: { status: "Cannot move this task" } })),
  } as unknown as ApiContextValue;

  await renderWithTheme(
    <TaskDetailScreen api={api} keys={keysStub} task={detail()} taskId="task-1" />,
  );
  const user = userEvent.setup();
  await user.press(screen.getByRole("button", { name: "Change status" }));
  await user.press(screen.getByRole("radio", { name: "done" }));

  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(screen.getByText("Cannot move this task")).toBeTruthy();
});