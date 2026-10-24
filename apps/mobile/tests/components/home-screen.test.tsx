import { render, screen } from "@testing-library/react-native";

import HomeScreen from "@/app/index";

it("renders the home screen", async () => {
  await render(<HomeScreen />);

  expect(screen.getByText("Metsys")).toBeTruthy();
});
