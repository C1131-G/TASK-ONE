import { Text, View } from "react-native";
import { screen, userEvent } from "@testing-library/react-native";

import {
  WorkspaceAccountMenu,
  WorkspaceCreateMenu,
  WorkspaceSearchPalette,
} from "@/components/workspace/workspace-create-menu";
import { WorkspaceBottomNavigation } from "@/components/workspace/workspace-bottom-navigation";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";
import { WorkspaceTextInput } from "@/components/workspace/workspace-text-input";
import { WorkspaceListRow } from "@/components/workspace/workspace-list-row";
import { renderWithTheme } from "./support/theme";

it("renders the screen title as a header", async () => {
  await renderWithTheme(
    <WorkspaceScreen title="My Tasks">
      <Text>Body</Text>
    </WorkspaceScreen>,
  );

  expect(screen.getByRole("header", { name: "My Tasks" })).toBeTruthy();
});

it("renders the tab bar with the active tab and badge", async () => {
  let selected: string | null = null;
  const user = userEvent.setup();
  await renderWithTheme(
    <WorkspaceBottomNavigation
      activeLabel="Home"
      items={[
        { badge: 3, icon: <View />, label: "Home" },
        { icon: <View />, label: "My Tasks" },
        { icon: <View />, label: "Inbox" },
      ]}
      onSelect={(label: string) => (selected = label)}
    />,
  );

  const home = screen.getByRole("tab", { name: "Home" });
  expect(home.props.accessibilityState.selected).toBe(true);
  expect(screen.getByLabelText("3 unread")).toBeTruthy();

  await user.press(screen.getByRole("tab", { name: "Inbox" }));

  expect(selected).toBe("Inbox");
});

it("opens the create menu and runs an action", async () => {
  const events: string[] = [];
  const user = userEvent.setup();
  await renderWithTheme(
    <WorkspaceCreateMenu
      actions={[
        { label: "New task", onPress: () => events.push("task") },
        { label: "New project", onPress: () => events.push("project") },
      ]}
    />,
  );

  await user.press(screen.getByRole("button", { name: "Create" }));
  await user.press(await screen.findByRole("button", { name: "New task" }));

  expect(events).toEqual(["task"]);
});

it("searches through the palette and picks a result", async () => {
  let picked: string | null = null;
  const user = userEvent.setup();
  await renderWithTheme(
    <WorkspaceSearchPalette
      input={
        <WorkspaceTextInput
          accessibilityLabel="Search"
          onChangeText={() => undefined}
          placeholder="Search tasks"
          value=""
        />
      }
      onClose={() => undefined}
      visible
    >
      <WorkspaceListRow
        accessibilityLabel="Task Ship the release"
        onPress={() => (picked = "task-1")}
        title="Ship the release"
      />
    </WorkspaceSearchPalette>,
  );

  await user.press(screen.getByRole("button", { name: "Task Ship the release" }));

  expect(picked).toBe("task-1");
  expect(screen.getByLabelText("Search")).toBeTruthy();
});

it("shows the account identity and signs out", async () => {
  let signedOut = false;
  const user = userEvent.setup();
  await renderWithTheme(
    <WorkspaceAccountMenu
      email="ada@taskora.test"
      name="Ada Lovelace"
      onClose={() => undefined}
      onSignOut={() => (signedOut = true)}
      visible
    />,
  );

  expect(screen.getByText("Ada Lovelace")).toBeTruthy();
  expect(screen.getByText("ada@taskora.test")).toBeTruthy();

  await user.press(screen.getByRole("button", { name: "Sign out" }));

  expect(signedOut).toBe(true);
});
