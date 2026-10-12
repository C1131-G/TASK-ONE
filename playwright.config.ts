import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env["E2E_BASE_URL"] ?? "http://localhost:3000";
const chromiumPath =
  process.env["E2E_CHROMIUM_PATH"] ??
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

export default defineConfig({
  forbidOnly: Boolean(process.env["CI"]),
  fullyParallel: false,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  reporter: [["list"]],
  retries: 0,
  // The dev server compiles routes on first use, so give each test room.
  testDir: "tests/e2e",
  timeout: 120_000,
  use: {
    baseURL,
    launchOptions: { executablePath: chromiumPath },
    trace: "retain-on-failure",
  },
});
