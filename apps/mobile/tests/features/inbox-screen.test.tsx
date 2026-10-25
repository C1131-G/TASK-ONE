import { screen, userEvent, waitFor } from "@testing-library/react-native";
import { Effect } from "effect";

import { InboxScreen } from "@/features/inbox/inbox-screen";
import { splitInbox, type InboxItem } from "@/features/inbox/queries";
import { ValidationFailed } from "@/errors";
import type { ApiContextValue, KeysContextValue } from "@/runtime/api-hooks";
import { renderWithTheme } from "../components/support/theme";

const ITEMS: readonly InboxItem[] = [
  {
    createdAt: "2026-10-24T09:15:00.000Z",
    id: "notif-1",
    kind: "assignment",
    readAt: null,
    taskId: "task-1",
    taskTitle: "Ship the landing page",
    title: "Ada assigned you a task",
  },
  {
    createdAt: "2026-10-24T08:00:00.000Z",
    id: "notif-2",
    kind: "mention",
    readAt: null,
    taskId: null,
    taskTitle: null,
    title: "Grace mentioned you",
  },
  {
    createdAt: "2026-10-23T17:30:00.000Z",
    id: "notif-3",
    kind: "comment",
    readAt: "2026-10-23T18:00:00.000Z",
    taskId: "task-2",
    taskTitle: "Draft the announcement",
    title: "New comment on your task",
  },
];

it("splits the inbox into all and unread", () => {
  const groups = splitInbox(ITEMS);

  expect(groups.all.length).toBe(3);
  expect(groups.unread.map((item) => item.id)).toEqual(["notif-1", "notif-2"]);
});

const keysStub: KeysContextValue = {
  forget: () => Effect.void,
  run: (_intent, program) => program("key-1234567890"),
};

const apiStub: ApiContextValue = {
  call: (run: (client: unknown) => Promise<unknown>) =>
    Effect.tryPromise({
      catch: () => new ValidationFailed({ fieldErrors: {} }),
      try: () =>
        run({
          markAllInboxRead: () => Promise.resolve({ unread: 0 }),
          markInboxItemRead: (input: { readonly params: { readonly id: string } }) =>
            Promise.resolve({ id: input.params.id, readAt: "2026-10-25T09:00:00.000Z" }),
        }),
    }),
} as unknown as ApiContextValue;

it("shows the tabs, unread badge counts and switches to unread", async () => {
  const user = userEvent.setup();
  await renderWithTheme(
    <InboxScreen api={apiStub} items={ITEMS} keys={keysStub} onOpenTask={() => undefined} />,
  );

  expect(screen.getByText("All 3")).toBeTruthy();
  expect(screen.getByText("Unread 2")).toBeTruthy();
  expect(screen.getByText("New comment on your task")).toBeTruthy();

  await user.press(screen.getByRole("tab", { name: "Unread 2" }));

  expect(screen.queryByText("New comment on your task")).toBeNull();
});

it("marks an unread item and opens its task", async () => {
  const readIds: string[] = [];
  const openedTasks: string[] = [];
  const api: ApiContextValue = {
    call: (run: (client: unknown) => Promise<unknown>) =>
      Effect.tryPromise({
        catch: () => new ValidationFailed({ fieldErrors: {} }),
        try: () =>
          run({
            markAllInboxRead: () => Promise.resolve({ unread: 0 }),
            markInboxItemRead: (input: { readonly params: { readonly id: string } }) => {
              readIds.push(input.params.id);
              return Promise.resolve({ id: input.params.id, readAt: "r" });
            },
          }),
      }),
  } as unknown as ApiContextValue;

  const user = userEvent.setup();
  await renderWithTheme(
    <InboxScreen
      api={api}
      items={ITEMS}
      keys={keysStub}
      onOpenTask={(taskId) => openedTasks.push(taskId)}
    />,
  );

  await user.press(screen.getByRole("button", { name: "Unread: Ada assigned you a task" }));

  await waitFor(() => expect(readIds).toEqual(["notif-1"]));
  expect(openedTasks).toEqual(["task-1"]);
});

it("marks everything read at once", async () => {
  const markedAll: string[] = [];
  const api: ApiContextValue = {
    call: (run: (client: unknown) => Promise<unknown>) =>
      Effect.tryPromise({
        catch: () => new ValidationFailed({ fieldErrors: {} }),
        try: () =>
          run({
            markAllInboxRead: (input: { readonly idempotencyKey: string }) => {
              markedAll.push(input.idempotencyKey);
              return Promise.resolve({ unread: 0 });
            },
            markInboxItemRead: (input: { readonly params: { readonly id: string } }) =>
              Promise.resolve({ id: input.params.id, readAt: "r" }),
          }),
      }),
  } as unknown as ApiContextValue;

  const user = userEvent.setup();
  await renderWithTheme(
    <InboxScreen api={api} items={ITEMS} keys={keysStub} onOpenTask={() => undefined} />,
  );

  await user.press(screen.getByRole("button", { name: "Mark all read" }));

  await waitFor(() => expect(markedAll.length).toBe(1));
});
