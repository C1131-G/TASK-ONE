import { AccessibilityInfo, Text } from "react-native";
import { renderHook, screen, userEvent, waitFor } from "@testing-library/react-native";


import { WorkspaceEmptyState } from "@/components/workspace/workspace-empty-state";
import { WorkspaceErrorState } from "@/components/workspace/workspace-error-state";
import {
  WorkspaceRevealGate,
  usePrefersReducedMotion,
} from "@/components/workspace/workspace-reveal-gate";
import { WorkspaceSkeleton } from "@/components/workspace/workspace-skeleton";
import { Conflict, Offline, Unavailable, ValidationFailed } from "@/errors";
import { renderWithTheme } from "./support/theme";

it("renders skeleton shapes and the panel skeleton", async () => {
  await renderWithTheme(
    <>
      <WorkspaceSkeleton height={20} width={120} />
      <WorkspaceSkeleton variant="panel" />
    </>,
  );

  expect(screen.getAllByTestId("skeleton-shape").length).toBeGreaterThanOrEqual(4);
});

it("shows the empty state with title, message and action", async () => {
  let pressed = false;
  const user = userEvent.setup();
  await renderWithTheme(
    <WorkspaceEmptyState
      action={{ label: "New task", onPress: () => (pressed = true) }}
      message="No tasks match the current filters."
      title="Nothing here"
    />,
  );

  expect(screen.getByText("Nothing here")).toBeTruthy();
  expect(screen.getByText("No tasks match the current filters.")).toBeTruthy();

  await user.press(screen.getByRole("button", { name: "New task" }));

  expect(pressed).toBe(true);
});

it("matches each error tag to a message", async () => {
  await renderWithTheme(
    <>
      <WorkspaceErrorState failure={new Unavailable({ requestId: "req-9" })} />
      <WorkspaceErrorState failure={new Conflict({ currentVersion: 3 })} />
      <WorkspaceErrorState
        failure={new ValidationFailed({ fieldErrors: { title: "Title is required" } })}
      />
      <WorkspaceErrorState failure={new Offline()} />
    </>,
  );

  expect(screen.getByText("The service is temporarily unavailable. Try again.")).toBeTruthy();
  expect(screen.getByText("Someone else changed this item. Reload to continue.")).toBeTruthy();
  expect(screen.getByText("Title is required")).toBeTruthy();
  expect(screen.getByText("You appear to be offline. Reconnect and retry.")).toBeTruthy();
});

it("offers a retry action when provided", async () => {
  let retries = 0;
  const user = userEvent.setup();
  await renderWithTheme(<WorkspaceErrorState failure={new Offline()} onRetry={() => (retries += 1)} />);

  await user.press(screen.getByRole("button", { name: "Try again" }));

  expect(retries).toBe(1);
});

it("reports the system reduced-motion preference", async () => {
  const spy = jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);

  const { result } = await renderHook(() => usePrefersReducedMotion());

  await waitFor(() => expect(result.current).toBe(true));
  spy.mockRestore();
});

it("reveals its children", async () => {
  await renderWithTheme(
    <WorkspaceRevealGate>
      <Text>Revealed content</Text>
    </WorkspaceRevealGate>,
  );

  expect(screen.getByText("Revealed content")).toBeTruthy();
});
