import { screen } from "@testing-library/react-native";

import HomeRoute from "@/apps/web/app/(workspace)/index";
import { renderWithTheme } from "../components/support/theme";

it("renders the home loading shell without a session", async () => {
  await renderWithTheme(<HomeRoute />);

  expect(screen.getAllByTestId("skeleton-shape").length).toBeGreaterThan(0);
});
