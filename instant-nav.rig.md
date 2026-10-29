---
title: Instant navigation Playwright runbook
type: runbook
status: current
updated: 2026-10-29
---

<!-- markdownlint-disable MD025 -->

# Instant navigation Playwright runbook

Use this runbook to check that route shells and skeletons appear during initial loads and soft navigation. It covers the focused instant-navigation Playwright checks against a local production build.

## Symptoms

- A page shell or loading skeleton appears late, flashes, or is missing during navigation.
- A protected route redirects unexpectedly, or a lock assertion does not match the server being tested.

## Diagnose

1. Confirm the test commands exist in [`package.json`](package.json) and review the browser/server configuration in [`playwright.config.ts`](playwright.config.ts) and [`next.config.ts`](next.config.ts).
2. Ensure no development server is using this checkout. Next development and production builds share `.next`, so a concurrent server can invalidate the build being measured.
3. Confirm the local database is reachable with `bun run db:verify`. The backend test harness can create and migrate a separate `taskora*_test` database; keep it separate from the application database.
4. Check that `.env.e2e.local` exists locally if the auth setup needs credentials. It is ignored by Git, and Playwright loads it from [`playwright.config.ts`](playwright.config.ts). Saved browser states are under the ignored `tests/e2e/.auth/` directory.

## Fix

1. In PowerShell, from the repository root, build with the testing API enabled:

   ```powershell
   $env:EXPOSE_TESTING_API = "1"
   bun run build
   ```

   [`next.config.ts`](next.config.ts) enables `exposeTestingApiInProductionBuild` only when `EXPOSE_TESTING_API=1` is present during the build. Do not enable it for deployed production builds.

2. In a second PowerShell terminal, start the built app. `next start` uses port 3000 by default; keep the testing API variable set for this process too:

   ```powershell
   $env:EXPOSE_TESTING_API = "1"
   bun run start
   ```

3. Set Playwright's local URL and, on Windows, the path to an installed Chromium executable. Then create or refresh the saved auth states by running the setup project:

   ```powershell
   $env:E2E_BASE_URL = "http://localhost:3000"
   $env:E2E_CHROMIUM_PATH = "C:\path\to\chrome.exe"
   bun run test:e2e -- --project=setup
   ```

   `E2E_CHROMIUM_PATH` is optional when Playwright's bundled browser is available. The setup project uses local E2E credentials and writes ignored state files, including the admin state used by the `chromium` project.

4. Run the focused route-shell guards against that same server:

   ```powershell
   bun run test:e2e -- --project=chromium --no-deps --workers=1 tests/e2e/overview-page.spec.ts tests/e2e/tasks-instant-flow.spec.ts tests/e2e/clients-portal-instant-flow.spec.ts tests/e2e/workspace-instant-flow.spec.ts
   ```

   These specs cover overview, tasks, clients, audit, portal, and workspace routes, including detail routes. The login navigation smoke checks are in [`tests/e2e/login-instant-flow.spec.ts`](tests/e2e/login-instant-flow.spec.ts); they begin signed out because an authenticated session redirects away from `/login`.

5. Compare the measured page states with the corresponding skeletons, adjust the relevant UI only when there is a mismatch, then rebuild and repeat the same checks. Stop the production server when finished.

## Escalate

- If `.next` is being used by `next dev`, stop that process and rebuild before trusting results.
- If authenticated checks redirect to `/login`, rerun the setup project and confirm the seeded test account and `.env.e2e.local` credentials are valid.
- If lock assertions fail, verify that the server at `http://localhost:3000` was both built and started with `EXPOSE_TESTING_API=1`.
- If Playwright cannot launch Chrome on Windows, set `E2E_CHROMIUM_PATH` to an installed Chrome executable and rerun the focused specs.
