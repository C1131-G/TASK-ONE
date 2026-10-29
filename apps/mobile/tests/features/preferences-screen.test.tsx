import { screen, userEvent, waitFor } from "@testing-library/react-native";
import { Effect } from "effect";

import { ValidationFailed } from "@/errors";
import { PreferencesScreen } from "@/features/preferences/preferences-screen";
import { groupByEvent, type Preference } from "@/features/preferences/queries";
import type { ApiContextValue, KeysContextValue } from "@/runtime/api-hooks";
import { renderWithTheme } from "../components/support/theme";

const PREFERENCES: readonly Preference[] = [
  { channel: "in-app", enabled: true, eventType: "mention" },
  { channel: "email", enabled: false, eventType: "mention" },
  { channel: "in-app", enabled: false, eventType: "due" },
];

const keysStub: KeysContextValue = {
  forget: () => Effect.void,
  run: (_intent, program) => program("key-1234567890"),
};

const apiThat = (setWorkspace: (input: unknown) => Promise<unknown>): ApiContextValue =>
  ({
    call: (run: (client: unknown) => Promise<unknown>) =>
      Effect.tryPromise({
        catch: () => new ValidationFailed({ fieldErrors: {} }),
        try: () =>
          run({
            setPortalNotificationPreference: (input: unknown) => setWorkspace(input),
            setWorkspaceNotificationPreference: (input: unknown) => setWorkspace(input),
          }),
      }),
  }) as unknown as ApiContextValue;

it("groups the settings by kind in the order the server gave", () => {
  const groups = groupByEvent(PREFERENCES);

  expect(groups.map((group) => group.eventType)).toEqual(["mention", "due"]);
  expect(groups[0]?.rows.map((row) => row.channel)).toEqual(["in-app", "email"]);
});

it("shows every kind and channel with its state", async () => {
  await renderWithTheme(
    <PreferencesScreen
      api={apiThat(() => Promise.resolve({ done: true }))}
      audience="workspace"
      keys={keysStub}
      preferences={PREFERENCES}
    />,
  );

  expect(screen.getByText("Mentions")).toBeTruthy();
  expect(screen.getByText("Due dates")).toBeTruthy();
  expect(screen.getByRole("switch", { name: "Mentions: In the app" })).toBeTruthy();
  expect(screen.getByRole("switch", { checked: true, name: "Mentions: In the app" })).toBeTruthy();
  expect(screen.getByRole("switch", { checked: false, name: "Mentions: Email" })).toBeTruthy();
});

it("switches a kind on under an idempotency key and shows it at once", async () => {
  const sent: unknown[] = [];
  const user = userEvent.setup();
  await renderWithTheme(
    <PreferencesScreen
      api={apiThat((input) => {
        sent.push(input);
        return Promise.resolve({ done: true });
      })}
      audience="workspace"
      keys={keysStub}
      preferences={PREFERENCES}
    />,
  );

  await user.press(screen.getByRole("switch", { name: "Due dates: In the app" }));

  await waitFor(() => expect(sent).toHaveLength(1));
  expect(sent[0]).toEqual({
    body: { channel: "in-app", enabled: true, eventType: "due" },
    idempotencyKey: "key-1234567890",
  });
});

it("puts the switch back when the server refuses the change", async () => {
  const user = userEvent.setup();
  await renderWithTheme(
    <PreferencesScreen
      api={apiThat(() => Promise.reject(new Error("refused")))}
      audience="workspace"
      keys={keysStub}
      preferences={PREFERENCES}
    />,
  );

  await user.press(screen.getByRole("switch", { name: "Mentions: In the app" }));

  await waitFor(() =>
    expect(screen.getByRole("switch", { checked: true, name: "Mentions: In the app" })).toBeTruthy(),
  );
});

it("sends a client's change through the portal route with only the two kinds a client can have", async () => {
  const sent: unknown[] = [];
  const user = userEvent.setup();
  await renderWithTheme(
    <PreferencesScreen
      api={apiThat((input) => {
        sent.push(input);
        return Promise.resolve({ done: true });
      })}
      audience="portal"
      keys={keysStub}
      preferences={[{ channel: "email", enabled: true, eventType: "status" }]}
    />,
  );

  await user.press(screen.getByRole("switch", { name: "Status changes: Email" }));

  await waitFor(() => expect(sent).toHaveLength(1));
  expect(sent[0]).toEqual({
    body: { channel: "email", enabled: false, eventType: "status" },
    idempotencyKey: "key-1234567890",
  });
});

it("says so when there is nothing to switch", async () => {
  await renderWithTheme(
    <PreferencesScreen
      api={apiThat(() => Promise.resolve({ done: true }))}
      audience="portal"
      keys={keysStub}
      preferences={[]}
    />,
  );

  expect(screen.getByText("No settings")).toBeTruthy();
});
