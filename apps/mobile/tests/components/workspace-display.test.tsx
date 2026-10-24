import { screen, userEvent } from "@testing-library/react-native";
import { View } from "react-native";

import { WorkspaceAvatar } from "@/components/workspace/workspace-avatar";
import { WorkspaceChip } from "@/components/workspace/workspace-chip";
import { WorkspaceListRow } from "@/components/workspace/workspace-list-row";
import { WorkspaceUndoToast } from "@/components/workspace/workspace-undo";
import { renderWithTheme } from "./support/theme";

it("renders the chip with a selected state and a remove action", async () => {
  let removed = false;
  const user = userEvent.setup();
  await renderWithTheme(
    <WorkspaceChip
      color="green"
      label="design"
      onRemove={() => (removed = true)}
      selected
    />,
  );

  expect(screen.getByRole("button", { name: "Remove design" })).toBeTruthy();

  await user.press(screen.getByRole("button", { name: "Remove design" }));

  expect(removed).toBe(true);
});

it("shows the avatar initials and announces the name", async () => {
  await renderWithTheme(<WorkspaceAvatar name="Ada Lovelace" />);

  expect(screen.getByRole("image", { name: "Ada Lovelace" })).toBeTruthy();
  expect(screen.getByText("AL")).toBeTruthy();
});

it("presses a list row and shows subtitle and trailing slot", async () => {
  let opened = false;
  const user = userEvent.setup();
  await renderWithTheme(
    <WorkspaceListRow
      accessibilityLabel="Open task Ship the release"
      onPress={() => (opened = true)}
      subtitle="Due tomorrow"
      title="Ship the release"
      trailing={<View testID="trailing-badge" />}
    />,
  );

  await user.press(screen.getByRole("button", { name: "Open task Ship the release" }));

  expect(opened).toBe(true);
  expect(screen.getByText("Due tomorrow")).toBeTruthy();
  expect(screen.getByTestId("trailing-badge")).toBeTruthy();
});

it("renders a static list row without a button role", async () => {
  await renderWithTheme(<WorkspaceListRow title="Read only" />);

  expect(screen.getByText("Read only")).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
});

it("runs the undo action and dismisses the toast", async () => {
  const events: string[] = [];
  const user = userEvent.setup();
  await renderWithTheme(
    <WorkspaceUndoToast
      message="Task archived"
      onAction={() => events.push("undo")}
      onClose={() => events.push("close")}
      visible
    />,
  );

  await user.press(screen.getByRole("button", { name: "Undo" }));
  await user.press(screen.getByRole("button", { name: "Dismiss" }));

  expect(events).toEqual(["undo", "close"]);
});
