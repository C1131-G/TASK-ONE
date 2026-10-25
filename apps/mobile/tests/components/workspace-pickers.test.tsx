import { fireEvent, screen, userEvent } from "@testing-library/react-native";

import { WorkspaceCombobox } from "@/components/workspace/workspace-combobox";
import { WorkspaceDatePicker } from "@/components/workspace/workspace-date-picker";
import { WorkspaceSelect } from "@/components/workspace/workspace-select";
import { renderWithTheme } from "./support/theme";

const STATUS_OPTIONS = [
  { label: "To do", value: "todo" },
  { label: "In progress", value: "progress" },
  { label: "Done", value: "done" },
];

it("opens the select sheet and picks an option", async () => {
  let picked: string | null = null;
  const user = userEvent.setup();
  await renderWithTheme(
    <WorkspaceSelect
      label="Status"
      onChange={(value) => {
        picked = value;
      }}
      options={STATUS_OPTIONS}
      value={null}
    />,
  );

  await user.press(screen.getByRole("button", { name: "Status" }));
  await user.press(await screen.findByRole("radio", { name: "In progress" }));

  expect(picked).toBe("progress");
});

it("shows the selected option label on the trigger", async () => {
  await renderWithTheme(
    <WorkspaceSelect
      label="Status"
      onChange={() => undefined}
      options={STATUS_OPTIONS}
      value="done"
    />,
  );

  expect(screen.getByText("Done")).toBeTruthy();
});

it("filters combobox options and picks one", async () => {
  let picked: string | null = null;
  const user = userEvent.setup();
  await renderWithTheme(
    <WorkspaceCombobox
      label="Assignee"
      onChange={(value) => {
        picked = value;
      }}
      options={[
        { label: "Ada Lovelace", value: "ada" },
        { label: "Grace Hopper", value: "grace" },
      ]}
      value={null}
    />,
  );

  await user.press(screen.getByRole("button", { name: "Assignee" }));
  await user.type(await screen.findByLabelText("Filter Assignee"), "grace");
  await user.press(screen.getByRole("option", { name: "Grace Hopper" }));

  expect(picked).toBe("grace");
  expect(screen.queryByRole("option", { name: "Ada Lovelace" })).toBeNull();
});

it("commits a picked date through confirm", async () => {
  let committed: string | null = null;
  const user = userEvent.setup();
  await renderWithTheme(
    <WorkspaceDatePicker
      label="Due date"
      onChange={(iso) => {
        committed = iso;
      }}
      timeZone="Asia/Kolkata"
      value={null}
    />,
  );

  await user.press(screen.getByRole("button", { name: "Due date" }));
  fireEvent(await screen.findByTestId("native-datepicker"), "change", {
    type: "set",
    nativeEvent: { timestamp: Date.UTC(2026, 9, 26, 10, 30) },
  });
  await user.press(await screen.findByRole("button", { name: "Confirm" }));

  expect(committed).toContain("2026-10-26");
});

it("clears the date", async () => {
  let committed: string | null | undefined = undefined;
  const user = userEvent.setup();
  await renderWithTheme(
    <WorkspaceDatePicker
      label="Due date"
      onChange={(iso) => {
        committed = iso;
      }}
      value="2026-10-26T10:30:00.000Z"
    />,
  );

  await user.press(screen.getByRole("button", { name: "Due date" }));
  await user.press(await screen.findByRole("button", { name: "Clear" }));

  expect(committed).toBeNull();
});
