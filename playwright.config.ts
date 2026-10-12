import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env["E2E_BASE_URL"] ?? "http://localhost:3000";

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
  testDir: "tests/e2e",
  use: {
    baseURL,
    launchOptions: {
      executablePath:
        process.env["E2E_CHROMIUM_PATH"] ??
        "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    },
    trace: "retain-on-failure",
  },
});
