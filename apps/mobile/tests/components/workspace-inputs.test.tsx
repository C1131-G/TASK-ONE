import { fireEvent, screen } from "@testing-library/react-native";

import { WorkspaceField } from "@/components/workspace/workspace-field";
import {
  WorkspaceCheckbox,
  WorkspaceSwitch,
} from "@/components/workspace/workspace-controls";
import { WorkspaceFieldError } from "@/components/workspace/workspace-field-error";
import { WorkspaceTextInput } from "@/components/workspace/workspace-text-input";
import { ValidationFailed } from "@/errors";
import { renderWithTheme } from "./support/theme";

it("labels its text input through the field", async () => {
  await renderWithTheme(
    <WorkspaceField label="Task title" hint="Shown on the board">
      <WorkspaceTextInput value="" onChangeText={() => undefined} />
    </WorkspaceField>,
  );

  const input = screen.getByLabelText("Task title");

  expect(input).toBeTruthy();
  expect(screen.getByText("Shown on the board")).toBeTruthy();
});

it("emits each change of the text input", async () => {
  const values: string[] = [];
  await renderWithTheme(
    <WorkspaceField label="Title">
      <WorkspaceTextInput
        value=""
        onChangeText={(value) => values.push(value)}
        placeholder="What needs doing"
      />
    </WorkspaceField>,
  );

  fireEvent.changeText(screen.getByLabelText("Title"), "Ship it");

  expect(values).toEqual(["Ship it"]);
});

it("renders the ValidationFailed field errors and hides other failures", async () => {
  await renderWithTheme(
    <>
      <WorkspaceFieldError
        failure={new ValidationFailed({ fieldErrors: { title: "Title is required" } })}
        field="title"
      />
      <WorkspaceFieldError
        failure={new ValidationFailed({ fieldErrors: { other: "Other problem" } })}
        field="missing"
      />
    </>,
  );

  expect(screen.getByText("Title is required")).toBeTruthy();
  expect(screen.queryByText("Other problem")).toBeNull();
});

it("marks an invalid input for the accessibility state", async () => {
  await renderWithTheme(
    <WorkspaceField label="Email">
      <WorkspaceTextInput invalid value="nope" onChangeText={() => undefined} />
    </WorkspaceField>,
  );

  expect(screen.getByLabelText("Email").props["aria-invalid"]).toBe(true);
});

it("toggles the switch and reports its state", async () => {
  let enabled = false;
  await renderWithTheme(
    <WorkspaceSwitch
      label="Push notifications"
      onValueChange={(next) => {
        enabled = next;
      }}
      value={enabled}
    />,
  );

  fireEvent(screen.getByRole("switch", { name: "Push notifications" }), "valueChange", true);

  expect(enabled).toBe(true);
});

it("toggles the checkbox row and reports its checked state", async () => {
  let checked = false;
  await renderWithTheme(
    <WorkspaceCheckbox
      checked={checked}
      label="Include evidence"
      onToggle={(next) => {
        checked = next;
      }}
    />,
  );

  fireEvent.press(screen.getByRole("checkbox", { name: "Include evidence" }));

  expect(checked).toBe(true);
});
