import { screen, userEvent } from "@testing-library/react-native";
import { Text } from "react-native";

import {
  WorkspaceConfirmDialog,
  WorkspaceModal,
} from "@/components/workspace/workspace-modal";
import { WorkspaceDisclosure } from "@/components/workspace/workspace-disclosure";
import { renderWithTheme } from "./support/theme";

it("shows the modal content when visible and hides it otherwise", async () => {
  await renderWithTheme(
    <>
      <WorkspaceModal onClose={() => undefined} title="Hidden panel" visible={false}>
        <Text>Hidden body</Text>
      </WorkspaceModal>
      <WorkspaceModal onClose={() => undefined} title="Edit task" visible>
        <Text>Visible body</Text>
      </WorkspaceModal>
    </>,
  );

  expect(screen.getByRole("dialog", { name: "Edit task" })).toBeTruthy();
  expect(screen.getByText("Visible body")).toBeTruthy();
  expect(screen.queryByText("Hidden body")).toBeNull();
});

it("closes the modal from the overlay press", async () => {
  let closed = false;
  const user = userEvent.setup();
  await renderWithTheme(
    <WorkspaceModal
      onClose={() => {
        closed = true;
      }}
      title="Edit task"
      visible
    >
      <Text>Overlay body</Text>
    </WorkspaceModal>,
  );

  await user.press(screen.getByTestId("modal-overlay"));

  expect(closed).toBe(true);
});

it("fires confirm and cancel from the confirm dialog", async () => {
  const events: string[] = [];
  const user = userEvent.setup();
  await renderWithTheme(
    <WorkspaceConfirmDialog
      confirmLabel="Archive project"
      message="The project moves to the archive and stays readable."
      onCancel={() => events.push("cancel")}
      onConfirm={() => events.push("confirm")}
      title="Archive project"
      visible
    />,
  );

  expect(screen.getByRole("dialog", { name: "Archive project" })).toBeTruthy();

  await user.press(screen.getByRole("button", { name: "Cancel" }));
  await user.press(screen.getByRole("button", { name: "Archive project" }));

  expect(events).toEqual(["cancel", "confirm"]);
});

it("toggles the disclosure body and reports its expanded state", async () => {
  const user = userEvent.setup();
  await renderWithTheme(
    <WorkspaceDisclosure header="Milestones">
      <Text>Milestone rows</Text>
    </WorkspaceDisclosure>,
  );

  const header = screen.getByRole("button", { name: "Milestones" });
  expect(header.props.accessibilityState.expanded).toBe(false);
  expect(screen.queryByText("Milestone rows")).toBeNull();

  await user.press(header);
  expect(screen.getByText("Milestone rows")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Milestones" }).props.accessibilityState.expanded,
  ).toBe(true);
});
