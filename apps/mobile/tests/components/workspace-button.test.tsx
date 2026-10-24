import { fireEvent, screen } from "@testing-library/react-native";

import { WorkspaceButton, WorkspaceIconButton } from "@/components/workspace/workspace-button";
import { View } from "react-native";
import { renderWithTheme } from "./support/theme";

it("renders a labeled button with the button role", async () => {
  await renderWithTheme(
    <WorkspaceButton onPress={() => undefined}>Save changes</WorkspaceButton>,
  );

  expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy();
});

it("marks a disabled button in its accessibility state", async () => {
  await renderWithTheme(<WorkspaceButton disabled>Archive</WorkspaceButton>);

  expect(screen.getByRole("button", { name: "Archive" }).props.accessibilityState.disabled).toBe(
    true,
  );
});

it("fires onPress on activation", async () => {
  let presses = 0;
  await renderWithTheme(
    <WorkspaceButton onPress={() => (presses += 1)}>Go</WorkspaceButton>,
  );

  fireEvent.press(screen.getByRole("button", { name: "Go" }));

  expect(presses).toBe(1);
});

it("styles the primary variant with the accent color per theme", async () => {
  await renderWithTheme(<WorkspaceButton variant="primary">Primary</WorkspaceButton>);
  const lightBackground = JSON.stringify(screen.getByRole("button").props.style);

  await renderWithTheme(<WorkspaceButton variant="primary">Primary</WorkspaceButton>, {
    isDark: true,
  });
  const darkBackground = JSON.stringify(screen.getByRole("button").props.style);

  expect(lightBackground).toContain("#4b5bd6");
  expect(darkBackground).toContain("#8e9af3");
});

it("keeps a 44pt minimum touch target", async () => {
  await renderWithTheme(<WorkspaceButton size="sm">Small</WorkspaceButton>);

  const style = JSON.stringify(screen.getByRole("button", { name: "Small" }).props.style);

  expect(style).toContain("44");
});

it("renders the icon button with a required label and no text", async () => {
  await renderWithTheme(
    <WorkspaceIconButton accessibilityLabel="Close dialog" onPress={() => undefined}>
      <View />
    </WorkspaceIconButton>,
  );

  expect(screen.getByRole("button", { name: "Close dialog" })).toBeTruthy();
  expect(screen.queryByText("Close dialog")).toBeNull();
});
