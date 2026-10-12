import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

import { ADMIN_STATE } from "./tests/e2e/auth-state";

const baseURL = process.env["E2E_BASE_URL"] ?? "http://localhost:3000";
const chromiumPath =
  process.env["E2E_CHROMIUM_PATH"] ??
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

export default defineConfig({
  forbidOnly: Boolean(process.env["CI"]),
  fullyParallel: false,
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/u },
    {
      dependencies: ["setup"],
      name: "chromium",
      testIgnore: /auth\.setup\.ts/u,
      use: {
        ...devices["Desktop Chrome"],
        // Specs start signed in; the smoke spec opts out to test the login form.
        storageState: existsSync(ADMIN_STATE) ? ADMIN_STATE : undefined,
      },
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
