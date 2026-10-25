import { screen } from "@testing-library/react-native";

import WorkspaceHomeRoute from "@/app/(workspace)/index";
import { renderWithTheme } from "../components/support/theme";

it("renders the workspace placeholder", async () => {
  await renderWithTheme(<WorkspaceHomeRoute />);

  expect(screen.getByText("Workspace screens arrive in Phase 6.")).toBeTruthy();
});
